import { Link } from 'wouter';
import { Terminal } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="empty-page">
      <Terminal size={30} />
      <h1>404 / signal not found</h1>
      <Link href="/overview" className="btn btn-accent">Return to cockpit</Link>
    </div>
  );
}
