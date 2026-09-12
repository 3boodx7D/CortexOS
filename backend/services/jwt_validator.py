import time
from typing import Dict, Any, Optional
import jwt
from jwt import PyJWKClient, PyJWTError
from backend.config import SUPABASE_URL, SUPABASE_JWKS_URL

_jwks_client: Optional[PyJWKClient] = None
_jwks_client_created = 0.0

def get_jwks_client() -> Optional[PyJWKClient]:
    """Returns a cached PyJWKClient instance for Supabase auth."""
    global _jwks_client, _jwks_client_created
    if not SUPABASE_JWKS_URL:
        return None
    
    # Refresh client every hour
    now = time.time()
    if _jwks_client is None or (now - _jwks_client_created) > 3600:
        try:
            _jwks_client = PyJWKClient(SUPABASE_JWKS_URL, cache_keys=True, max_cached_keys=16)
            _jwks_client_created = now
        except Exception as e:
            print(f"[jwt_validator] Warning initializing JWKS client: {e}")
            return None
    return _jwks_client

def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Cryptographically verifies a Supabase JWT access token using JWKS.
    Enforces signature verification, issuer, audience, and expiration.
    Returns payload on success, or raises ValueError on invalid/expired token.
    """
    if not token or not isinstance(token, str):
        raise ValueError("Missing or invalid token string")

    # Clean Bearer prefix if present
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    client = get_jwks_client()
    if not client:
        # SECURITY: Never accept tokens without cryptographic verification.
        # If JWKS is not configured, reject all privileged requests.
        raise ValueError("JWKS endpoint not configured — cannot verify token signature. Set SUPABASE_URL in .env.")

    try:
        signing_key = client.get_signing_key_from_jwt(token)
        expected_issuer = f"{SUPABASE_URL.rstrip('/')}/auth/v1"
        
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
            issuer=expected_issuer,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
            }
        )
        return payload
    except PyJWTError as e:
        # Fallback check: Some Supabase projects use HS256 with JWT secret or different key ID
        try:
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get("alg")
            # If RS256/ES256 failed with JWKS, raise the cryptographic error
            raise ValueError(f"Cryptographic JWT verification failed ({alg}): {str(e)}")
        except Exception:
            raise ValueError(f"JWT verification failed: {str(e)}")
