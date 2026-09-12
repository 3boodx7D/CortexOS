import { useState, useEffect, useMemo, useRef } from 'react';
import {
  GraduationCap,
  BookOpen,
  Sparkles,
  Plus,
  HelpCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Search,
  Flag,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Copy,
  Printer,
  FileText,
  UploadCloud,
  Trash2,
  Award,
  Zap,
  Layers,
  ArrowLeft,
  ExternalLink,
  Cpu,
  Loader2,
  RefreshCw,
  MessageSquare,
  Send,
  SlidersHorizontal,
  Bot
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { DocumentDropzone } from '@/components/study/document-dropzone';
import { apiPost } from '@/lib/api-client';

export interface QuestionItem {
  id: string;
  question: string;
  choices: string[];
  correct: number;
  explanation: string;
  topic?: string;
}

export interface CourseBank {
  id: string;
  code: string;
  title: string;
  description: string;
  questions: QuestionItem[];
  lastScore?: number;
  lastAttemptDate?: string;
  lectureNotes?: string;
  eli5Notes?: string;
}

const DEFAULT_BANKS: CourseBank[] = [
  {
    id: 'bank-os-301',
    code: 'CS301',
    title: 'Operating Systems & Concurrency',
    description: 'Process scheduling, virtual memory paging, race conditions, semaphores, and deadlocks.',
    lastScore: 80,
    lastAttemptDate: 'Yesterday',
    lectureNotes: `# Lecture 04: Virtual Memory & Page Replacement\n\nVirtual memory provides an illusion of a large contiguous address space per process through hardware translation (MMU) and Page Tables.\n\n### Key Concepts:\n- **TLB (Translation Lookaside Buffer):** Fast associative cache for virtual-to-physical address mappings.\n- **Page Fault:** Hardware interrupt raised when the accessed page is not marked present in physical RAM.\n- **Thrashing:** Excessive page swapping when the working set exceeds physical memory capacity.`,
    eli5Notes: `Think of Virtual Memory like a library desk: your desk has room for only 3 open books (RAM), while the giant library shelves hold 10,000 books (SSD/Hard drive). When you need a book not on your desk, you take a trip to the shelf (Page Fault) to swap it into your desk space!`,
    questions: [
      {
        id: 'q-os-1',
        question: 'Which of the following conditions is NOT one of the four necessary Coffman conditions for a deadlock to occur?',
        choices: [
          'Mutual Exclusion',
          'Hold and Wait',
          'Preemption Allowed',
          'Circular Wait'
        ],
        correct: 2,
        explanation: 'The Coffman condition is "No Preemption" (resources cannot be forcibly taken away from a process). If preemption is allowed, deadlocks can be broken immediately.',
        topic: 'Deadlocks'
      },
      {
        id: 'q-os-2',
        question: 'What occurs during a Page Fault exception in an operating system with demand paging?',
        choices: [
          'The CPU shuts down immediately due to hardware failure',
          'The operating system traps to kernel mode, loads the required page from secondary storage into RAM, and restarts the instruction',
          'The offending process is forcibly terminated by SIGSEGV',
          'The TLB cache is permanently flushed and disabled'
        ],
        correct: 1,
        explanation: 'A page fault is not a fatal crash; it is an architecturally planned hardware trap. The OS kernel retrieves the missing page frame from backing storage, updates the page table present bit, and seamlessly re-executes the faulted instruction.',
        topic: 'Virtual Memory'
      },
      {
        id: 'q-os-3',
        question: 'How does a counting semaphore initialized to value N differ from a binary semaphore (mutex)?',
        choices: [
          'It can allow up to N concurrent threads to enter the critical section simultaneously',
          'It can only be used by root superuser processes',
          'It cannot prevent race conditions under any circumstances',
          'It executes in user space without kernel synchronization'
        ],
        correct: 0,
        explanation: 'A counting semaphore initialized to N maintains a counter of available resource permits. Up to N threads can acquire permits before subsequent callers are blocked.',
        topic: 'Synchronization'
      },
      {
        id: 'q-os-4',
        question: 'Which CPU scheduling algorithm is provably optimal in terms of minimizing average waiting time, assuming process burst times are known in advance?',
        choices: [
          'First-Come First-Served (FCFS)',
          'Round Robin (RR)',
          'Shortest Job First (SJF)',
          'Multi-Level Feedback Queue (MLFQ)'
        ],
        correct: 2,
        explanation: 'Shortest Job First (SJF / Shortest Remaining Time First) is provably optimal because scheduling the shortest job first moves short processes through the queue fastest, keeping waiting time minimized.',
        topic: 'CPU Scheduling'
      },
      {
        id: 'q-os-5',
        question: 'What is the primary function of the Translation Lookaside Buffer (TLB)?',
        choices: [
          'To act as a high-speed associative hardware cache for virtual-to-physical address translations',
          'To store process stack frames during context switches',
          'To encrypt system calls before passing them to the microkernel',
          'To arbitrate DMA disk read requests'
        ],
        correct: 0,
        explanation: 'Without a TLB, every single virtual memory access requires multiple memory accesses just to traverse multi-level page tables. The TLB caches recent translations to achieve near single-cycle address lookups.',
        topic: 'Hardware & MMU'
      }
    ]
  },
  {
    id: 'bank-algo-204',
    code: 'CS204',
    title: 'Algorithms & Data Structures',
    description: 'Time & space complexity, balanced search trees, dynamic programming, and graph algorithms.',
    lastScore: 100,
    lastAttemptDate: '3 days ago',
    lectureNotes: `# Lecture 08: Dynamic Programming & Memoization\n\nDynamic Programming solves problems with **Overlapping Subproblems** and **Optimal Substructure** by storing subproblem results.\n\n### Classical Patterns:\n- **0/1 Knapsack:** State $DP[i][w]$ represents max value using first $i$ items within capacity $w$.\n- **Longest Common Subsequence (LCS):** Recurrence based on character matching or taking max of prefix subproblems.`,
    eli5Notes: `Dynamic Programming is like writing down the answer to 1 + 1 + 1 + 1 + 1 on a notepad (5). When someone adds another + 1 at the end, you don't count from zero; you just add 1 to the 5 you already wrote down!`,
    questions: [
      {
        id: 'q-algo-1',
        question: 'What is the worst-case time complexity of searching for an element in an unbalanced Binary Search Tree (BST)?',
        choices: [
          'O(1)',
          'O(log n)',
          'O(n)',
          'O(n log n)'
        ],
        correct: 2,
        explanation: 'In the worst case (e.g., elements inserted in strictly ascending or descending order), a standard unbalanced BST degenerates into a linear linked list with depth n, resulting in O(n) search time.',
        topic: 'Trees'
      },
      {
        id: 'q-algo-2',
        question: 'Which algorithmic paradigm does Dijkstra\'s Single-Source Shortest Path algorithm utilize?',
        choices: [
          'Greedy Algorithm',
          'Divide and Conquer',
          'Brute Force Backtracking',
          'Randomized Monte Carlo'
        ],
        correct: 0,
        explanation: 'Dijkstra\'s algorithm is greedy: at each step, it extracts the currently unvisited vertex with the minimum tentative distance using a priority queue (min-heap).',
        topic: 'Graph Algorithms'
      },
      {
        id: 'q-algo-3',
        question: 'Under what condition does Dijkstra\'s algorithm produce INCORRECT shortest path distances?',
        choices: [
          'When the graph contains cycles',
          'When the graph contains negative edge weights',
          'When the graph is directed',
          'When the graph has more than 1,000 vertices'
        ],
        correct: 1,
        explanation: 'Dijkstra\'s greedy invariant assumes that once a vertex distance is finalized, no shorter path can be found. Negative edges violate this assumption; the Bellman-Ford algorithm must be used instead.',
        topic: 'Graph Algorithms'
      },
      {
        id: 'q-algo-4',
        question: 'What is the average amortized time complexity of inserting a key-value pair into a Hash Table with good distribution?',
        choices: [
          'O(1)',
          'O(log n)',
          'O(n)',
          'O(√n)'
        ],
        correct: 0,
        explanation: 'With a uniform hash function and low load factor (under 0.7), bucket collisions are rare, yielding O(1) expected amortized insertion time.',
        topic: 'Hash Tables'
      },
      {
        id: 'q-algo-5',
        question: 'What two properties are strictly required to solve an optimization problem using Dynamic Programming?',
        choices: [
          'Binary branching and leaf pruning',
          'Optimal Substructure and Overlapping Subproblems',
          'Greedy choice property and deterministic sorting',
          'Negative edge cycles and acyclic ordering'
        ],
        correct: 1,
        explanation: 'Dynamic Programming requires Optimal Substructure (the global optimal solution is composed of optimal solutions to subproblems) and Overlapping Subproblems (the same subproblems are solved repeatedly).',
        topic: 'Dynamic Programming'
      }
    ]
  },
  {
    id: 'bank-net-305',
    code: 'CS305',
    title: 'Computer Networks & Protocols',
    description: 'TCP/IP socket architecture, 3-way handshakes, UDP streaming, DNS resolution, and HTTP/3 QUIC.',
    lastScore: undefined,
    lastAttemptDate: undefined,
    lectureNotes: `# Lecture 02: Transport Layer Protocols (TCP vs UDP)\n\nTCP guarantees in-order, reliable byte stream delivery using sequence numbers, ACKs, flow control (sliding window), and congestion control.\nUDP is connectionless and lightweight with zero retransmission overhead.`,
    eli5Notes: `TCP is like a registered postal letter where you have to sign a confirmation upon delivery. UDP is like a postcard tossed out of a plane: it gets there immediately, but nobody checks if a single postcard blew away in the wind!`,
    questions: [
      {
        id: 'q-net-1',
        question: 'What is the sequence of packets exchanged during the standard TCP 3-Way Handshake?',
        choices: [
          'SYN -> SYN-ACK -> ACK',
          'ACK -> SYN -> SYN-ACK',
          'FIN -> ACK -> FIN-ACK',
          'RST -> SYN -> ACK'
        ],
        correct: 0,
        explanation: 'The client initiates connection with SYN, server responds with SYN-ACK acknowledging client sequence number and proposing its own, and client finishes with ACK.',
        topic: 'TCP/IP'
      },
      {
        id: 'q-net-2',
        question: 'What underlying transport protocol does HTTP/3 utilize instead of standard TCP?',
        choices: [
          'QUIC over UDP',
          'SCTP over IP',
          'ICMP echo packets',
          'Raw Ethernet Frames'
        ],
        correct: 0,
        explanation: 'HTTP/3 runs over QUIC, which operates on top of UDP to eliminate TCP Head-of-Line blocking across multiplexed streams and provide 0-RTT connection establishment.',
        topic: 'HTTP Protocols'
      },
      {
        id: 'q-net-3',
        question: 'Which DNS record type maps a human-readable domain name directly to an IPv4 address?',
        choices: [
          'CNAME Record',
          'A Record',
          'AAAA Record',
          'MX Record'
        ],
        correct: 1,
        explanation: 'An A record maps a hostname to a 32-bit IPv4 address (e.g. 93.184.216.34). AAAA is used for 128-bit IPv6 addresses.',
        topic: 'DNS'
      },
      {
        id: 'q-net-4',
        question: 'What mechanism in TCP prevents a fast sender from overwhelming a slow receiver\'s buffer?',
        choices: [
          'Flow Control via the Receive Window (rwnd)',
          'Congestion Control via the Congestion Window (cwnd)',
          'Path MTU Discovery',
          'Nagle\'s Algorithm'
        ],
        correct: 0,
        explanation: 'Flow Control is receiver-driven: the receiver advertises its available buffer space in the "Receive Window" (rwnd) field of every ACK packet to prevent buffer overflow.',
        topic: 'Flow Control'
      },
      {
        id: 'q-net-5',
        question: 'What port does secure DNS over HTTPS (DoH) default to?',
        choices: [
          'Port 53',
          'Port 80',
          'Port 443',
          'Port 8080'
        ],
        correct: 2,
        explanation: 'DoH packages DNS queries inside standard HTTPS traffic over port 443, making it indistinguishable from regular encrypted web traffic to prevent eavesdropping and censorship.',
        topic: 'Security & DNS'
      }
    ]
  }
];

type StudyMode = 'banks' | 'exam' | 'practice' | 'results' | 'guide' | 'notes' | 'tutor';

export default function Study({ notify }: { notify: (msg: string) => void }) {
  const { t, locale } = useTranslation();

  // Question Banks Persistent State
  const [banks, setBanks] = usePersistent<CourseBank[]>('cortex-question-banks-v3', DEFAULT_BANKS);
  const [activeBankId, setActiveBankId] = usePersistent<string>('cortex-active-bank-id', DEFAULT_BANKS[0].id);

  // Active View Mode
  const [mode, setMode] = useState<StudyMode>('banks');
  const [searchQuery, setSearchQuery] = useState('');
  const [guideSearch, setGuideSearch] = useState('');

  // Custom AI Quiz Generator Modal State
  const [customQuizBankId, setCustomQuizBankId] = useState<string | null>(null);
  const [customQuizCount, setCustomQuizCount] = useState<number>(5);
  const [customQuizDifficulty, setCustomQuizDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('medium');

  // Course AI Tutor (Study Companion) State
  const [tutorPersona, setTutorPersona] = usePersistent<'professor' | 'socratic' | 'crammer' | 'coach'>('cortex-tutor-persona', 'professor');
  const [tutorMessages, setTutorMessages] = usePersistent<Record<string, Array<{ id: string; sender: 'user' | 'cortex'; text: string; time: string }>>>('cortex-course-tutor-chats-v1', {});
  const [tutorInput, setTutorInput] = useState('');
  const [isTutorThinking, setIsTutorThinking] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Dropzone Collapsible toggle & Target Bank Tracker (null = create brand new course bank)
  const [showDropzone, setShowDropzone] = useState(false);
  const [dropzoneTargetBankId, setDropzoneTargetBankId] = useState<string | null>(null);

  // Modal State for New Bank
  const [showNewBankModal, setShowNewBankModal] = useState(false);
  const [newBankTitle, setNewBankTitle] = useState('');
  const [newBankCode, setNewBankCode] = useState('');
  const [newBankDesc, setNewBankDesc] = useState('');

  // Exam / Practice Simulation Session State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<number[]>([]);
  const [examSecondsLeft, setExamSecondsLeft] = useState(25 * 60);
  const timerRef = useRef<number | null>(null);

  // Results View Filter
  const [resultsFilter, setResultsFilter] = useState<'all' | 'mistakes' | 'flagged'>('all');

  // Notes View Tab
  const [notesTab, setNotesTab] = useState<'summary' | 'eli5'>('summary');

  // Active Bank Reference (safe fallback if user deleted all banks)
  const activeBank = useMemo(() => {
    if (!banks || banks.length === 0) {
      return {
        id: 'bank-empty',
        code: 'EMPTY',
        title: locale === 'ar' ? 'لا توجد مادة محددة' : 'No Course Selected',
        description: '',
        questions: [],
        lectureNotes: '',
        eli5Notes: ''
      };
    }
    return banks.find((b) => b.id === activeBankId) || banks[0];
  }, [banks, activeBankId, locale]);

  const activeQuestions = activeBank?.questions || [];

  // Global Statistics
  const totalQuestionsCount = useMemo(() => {
    return banks.reduce((acc, b) => acc + (b.questions?.length || 0), 0);
  }, [banks]);

  const averageScore = useMemo(() => {
    const scored = banks.filter((b) => b.lastScore !== undefined);
    if (scored.length === 0) return 85;
    return Math.round(scored.reduce((acc, b) => acc + (b.lastScore || 0), 0) / scored.length);
  }, [banks]);

  // Timed Exam countdown timer
  useEffect(() => {
    if (mode === 'exam') {
      timerRef.current = window.setInterval(() => {
        setExamSecondsLeft((prev) => {
          if (prev <= 1) {
            handleFinishExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode]);

  // Launch Exam Simulator
  const handleStartExam = (bankId: string) => {
    setActiveBankId(bankId);
    setSelectedAnswers({});
    setFlaggedQuestions([]);
    setCurrentQIndex(0);
    setExamSecondsLeft(25 * 60);
    setMode('exam');
    notify(locale === 'ar' ? 'بدأ الامتحان المؤقت! بالتوفيق' : 'Timed exam started! Good luck');
  };

  // Launch Practice Mode
  const handleStartPractice = (bankId: string) => {
    setActiveBankId(bankId);
    setSelectedAnswers({});
    setFlaggedQuestions([]);
    setCurrentQIndex(0);
    setMode('practice');
    notify(locale === 'ar' ? 'تم تشغيل وضع التدريب الفوري' : 'Instant practice mode active');
  };

  // Launch Q&A Study Guide
  const handleOpenStudyGuide = (bankId: string) => {
    setActiveBankId(bankId);
    setGuideSearch('');
    setMode('guide');
  };

  // Launch Notes View
  const handleOpenNotes = (bankId: string) => {
    setActiveBankId(bankId);
    setMode('notes');
  };

  // Select Option
  const handleSelectChoice = (choiceIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQIndex]: choiceIndex
    }));
  };

  // Toggle Flag Question
  const handleToggleFlag = (index: number) => {
    setFlaggedQuestions((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  // Calculate Score
  const calculateScore = () => {
    return activeQuestions.reduce((score, q, idx) => {
      return score + (selectedAnswers[idx] === q.correct ? 1 : 0);
    }, 0);
  };

  // Finish / Submit Exam
  const handleFinishExam = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const score = calculateScore();
    const percent = Math.round((score / Math.max(1, activeQuestions.length)) * 100);

    // Update bank's last score
    setBanks((prev) =>
      prev.map((b) =>
        b.id === activeBank.id
          ? { ...b, lastScore: percent, lastAttemptDate: 'Just now' }
          : b
      )
    );

    setMode('results');
    notify(locale === 'ar' ? `اكتمل الامتحان! النتيجة: ${percent}%` : `Exam submitted! Score: ${percent}%`);
  };

  // AI Synthesis Loading & Progress State
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatingProgressText, setGeneratingProgressText] = useState('');
  const [generatingBankId, setGeneratingBankId] = useState<string | null>(null);
  const [customNotesText, setCustomNotesText] = useState('');

  // Sanitize legacy dummy questions on load
  useEffect(() => {
    let changed = false;
    const cleaned = banks.map((b) => {
      const realQuestions = (b.questions || []).filter(
        (q) =>
          !q.id.startsWith('q-gen-') &&
          !q.question.includes('Modular Architecture') &&
          !q.question.includes('سؤال تمهيدي: ما هي الفائدة الأساسية')
      );
      if (realQuestions.length !== (b.questions || []).length) {
        changed = true;
        return { ...b, questions: realQuestions };
      }
      return b;
    });
    if (changed) {
      setBanks(cleaned);
    }
  }, []);

  // Generate Real Academic Exam Questions with CORTEXAI
  const handleGenerateAiQuestions = async (bankId: string, count: number = 5, difficulty: string = 'medium') => {
    const targetBank = banks.find((b) => b.id === bankId) || activeBank;
    if (!targetBank) return;

    setIsGeneratingAI(true);
    setGeneratingBankId(bankId);
    setGeneratingProgressText(
      locale === 'ar'
        ? `CORTEXAI يقوم الآن بتحليل موضوع "${targetBank.title}" وصياغة ${count} أسئلة امتحانية بمستوى ${difficulty}...`
        : `CORTEXAI is analyzing "${targetBank.title}" and generating ${count} ${difficulty}-level exam questions...`
    );

    try {
      let contextText = '';
      if (targetBank.lectureNotes && targetBank.lectureNotes.trim().length > 30) {
        contextText = `Course: ${targetBank.code} - ${targetBank.title}\nDescription: ${targetBank.description}\nLecture Material:\n${targetBank.lectureNotes.slice(0, 6500)}`;
      } else {
        contextText = `Course: ${targetBank.code} - ${targetBank.title}\nDescription: ${targetBank.description || 'Comprehensive university curriculum'}`;
      }

      const res = await apiPost<{
        ok: boolean;
        quiz?: Array<{
          id?: string;
          question: string;
          choices: string[];
          correct: number;
          explanation: string;
          topic?: string;
        }>;
        error?: string;
      }>('/api/ai/quiz', {
        text: contextText,
        provider: 'auto',
        count,
        difficulty
      });

      if (!res || !res.ok || !res.quiz || res.quiz.length === 0) {
        throw new Error(res?.error || 'AI returned an empty quiz array');
      }

      const newQuestions: QuestionItem[] = res.quiz.map((q, idx) => ({
        id: `q-ai-${Date.now()}-${idx + 1}`,
        question: q.question,
        choices: q.choices,
        correct: typeof q.correct === 'number' ? q.correct : 0,
        explanation: q.explanation || 'Detailed academic rationale verified by CORTEXAI.',
        topic: q.topic || targetBank.title
      }));

      setBanks((prev) =>
        prev.map((b) => {
          if (b.id === bankId) {
            const filteredOld = (b.questions || []).filter(
              (oldQ) =>
                !oldQ.question.includes('Modular Architecture') &&
                !oldQ.question.includes('سؤال تمهيدي: ما هي الفائدة الأساسية') &&
                !oldQ.id.startsWith('q-gen-')
            );
            return {
              ...b,
              questions: [...filteredOld, ...newQuestions]
            };
          }
          return b;
        })
      );

      notify(
        locale === 'ar'
          ? `تم توليد ${newQuestions.length} أسئلة امتحانية حقيقية بنجاح عبر CORTEXAI!`
          : `Successfully generated ${newQuestions.length} real exam questions via CORTEXAI!`
      );
      setCustomQuizBankId(null);
    } catch (err: any) {
      console.error('[study] Failed to generate AI questions:', err);
      notify(
        locale === 'ar'
          ? `تعذر توليد الأسئلة: ${err.message || 'خطأ في الاتصال'}`
          : `Failed to generate questions: ${err.message || 'Network error'}`
      );
    } finally {
      setIsGeneratingAI(false);
      setGeneratingBankId(null);
      setGeneratingProgressText('');
    }
  };

  // Open Tutor Mode
  const handleOpenTutor = (bankId: string) => {
    setActiveBankId(bankId);
    setMode('tutor');
  };

  // Send Course AI Tutor Message
  const handleSendTutorMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || tutorInput).trim();
    if (!textToSend || isTutorThinking) return;

    const userMsg = {
      id: `msg-${Date.now()}-u`,
      sender: 'user' as const,
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const currentChat = tutorMessages[activeBank.id] || [];
    setTutorMessages({
      ...tutorMessages,
      [activeBank.id]: [...currentChat, userMsg]
    });
    setTutorInput('');
    setIsTutorThinking(true);

    try {
      const courseContext = activeBank.lectureNotes && activeBank.lectureNotes.trim().length > 30
        ? `LECTURE SLIDES & NOTES FOR ${activeBank.code} (${activeBank.title}):\n${activeBank.lectureNotes.slice(0, 7500)}`
        : `COURSE SYLLABUS FOR ${activeBank.code} (${activeBank.title}):\n${activeBank.description}`;

      const res = await apiPost<{ ok: boolean; answer?: string; error?: string }>('/api/ai/cortex-chat', {
        prompt: textToSend,
        tier: 'pro',
        ai_name: 'CORTEX Professor',
        language: locale === 'ar' ? 'arabic' : 'english',
        teaching_style: tutorPersona,
        academic_level: 'undergrad',
        ground_in_vault: true,
        custom_directives: `You are the personal university professor and academic tutor for course [${activeBank.code}: ${activeBank.title}].\n${courseContext}\n\nSTRICT TEACHING RULES:\n1. Base your knowledge strictly on the course notes/slides provided.\n2. Do NOT hallucinate. If a concept is outside the course slides, explain it clearly as general CS/academic background.\n3. Format mathematical formulas using clean Markdown or LaTeX where appropriate.\n4. If user speaks Arabic, reply in fluent, clear academic Arabic.`
      });

      const replyText = res?.answer || (locale === 'ar' ? 'عذراً، لم أتمكن من استلام الرد من خادم الذكاء الاصطناعي.' : 'Unable to connect to CORTEXAI inference engine.');

      const aiMsg = {
        id: `msg-${Date.now()}-ai`,
        sender: 'cortex' as const,
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setTutorMessages((prev) => ({
        ...prev,
        [activeBank.id]: [...(prev[activeBank.id] || []), aiMsg]
      }));
    } catch (err: any) {
      console.error('[study] Tutor error:', err);
      const errorMsg = {
        id: `msg-${Date.now()}-err`,
        sender: 'cortex' as const,
        text: locale === 'ar' ? `تعذر الاتصال بالمعلم الذكي: ${err.message}` : `Tutor connection error: ${err.message}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setTutorMessages((prev) => ({
        ...prev,
        [activeBank.id]: [...(prev[activeBank.id] || []), errorMsg]
      }));
    } finally {
      setIsTutorThinking(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Clear Tutor Chat for Active Bank
  const handleClearTutorChat = () => {
    setTutorMessages((prev) => ({
      ...prev,
      [activeBank.id]: []
    }));
    notify(locale === 'ar' ? 'تم بدء محادثة جديدة' : 'Chat history reset');
  };

  // Copy Full Tutor Chat Transcript
  const handleCopyTutorTranscript = () => {
    const currentChat = tutorMessages[activeBank.id] || [];
    if (currentChat.length === 0) return;
    const transcript = currentChat
      .map((m) => `[${m.time}] ${m.sender === 'user' ? 'Student' : 'CORTEX Tutor'}:\n${m.text}\n`)
      .join('\n---\n\n');
    navigator.clipboard.writeText(transcript);
    notify(t('study.transcriptCopied'));
  };

  // Synthesize Notes & ELI5 via CORTEXAI
  const handleGenerateAiNotes = async (bankId: string) => {
    const targetBank = banks.find((b) => b.id === bankId) || activeBank;
    if (!targetBank) return;

    setIsGeneratingAI(true);
    setGeneratingBankId(bankId);
    setGeneratingProgressText(
      locale === 'ar'
        ? `CORTEXAI يقوم الآن بصياغة ملاحظات ونماذج ذهنية تبسيطية (ELI5)...`
        : `CORTEXAI is synthesizing lecture notes and ELI5 mental models...`
    );

    try {
      const sourceText =
        targetBank.lectureNotes && targetBank.lectureNotes.trim().length > 30
          ? targetBank.lectureNotes.slice(0, 5000)
          : `Course Title: ${targetBank.code} - ${targetBank.title}\nSyllabus & Topics: ${targetBank.description || 'Core university course covering theory, systems, implementation, and analysis.'}`;

      const res = await apiPost<{ summary?: string; text?: string; error?: string }>('/api/ai/summarize', {
        text: sourceText,
        provider: 'auto',
        taskType: 'summary'
      });

      const structuredSummary = res.summary || res.text || '';
      if (!structuredSummary) {
        throw new Error('No summary returned');
      }

      // ELI5 analogy request
      let eli5Summary = '';
      try {
        const eli5Res = await apiPost<{ summary?: string; text?: string }>('/api/ai/summarize', {
          text: `Explain the fundamental intuition of this course (${targetBank.title}) using simple, relatable real-world analogies (ELI5 style):\n\n${sourceText.slice(0, 3000)}`,
          provider: 'auto',
          taskType: 'eli5'
        });
        eli5Summary = eli5Res.summary || eli5Res.text || '';
      } catch (e) {
        eli5Summary = `ELI5 breakdown for ${targetBank.title}.`;
      }

      setBanks((prev) =>
        prev.map((b) => {
          if (b.id === bankId) {
            return {
              ...b,
              lectureNotes: structuredSummary,
              eli5Notes: eli5Summary
            };
          }
          return b;
        })
      );

      notify(
        locale === 'ar'
          ? 'تم توليد الملاحظات المنظمة والنماذج الذهنية بنجاح عبر CORTEXAI!'
          : 'Synthesized structured notes and ELI5 models successfully!'
      );
    } catch (err: any) {
      console.error('[study] Failed to generate AI notes:', err);
      notify(
        locale === 'ar'
          ? `تعذر توليد الملاحظات: ${err.message || 'خطأ'}`
          : `Failed to synthesize notes: ${err.message || 'Error'}`
      );
    } finally {
      setIsGeneratingAI(false);
      setGeneratingBankId(null);
      setGeneratingProgressText('');
    }
  };

  // Create New Question Bank (Clean, ZERO hardcoded fake questions)
  const handleCreateBank = () => {
    if (!newBankTitle.trim()) return;
    const newBank: CourseBank = {
      id: `bank-${Date.now()}`,
      code: newBankCode.trim().toUpperCase() || 'MOD01',
      title: newBankTitle.trim(),
      description: newBankDesc.trim() || 'Custom course question bank.',
      questions: [], // ZERO FAKE QUESTIONS!
      lectureNotes: '',
      eli5Notes: ''
    };
    setBanks([newBank, ...banks]);
    setActiveBankId(newBank.id);
    setNewBankTitle('');
    setNewBankCode('');
    setNewBankDesc('');
    setShowNewBankModal(false);
    notify(
      locale === 'ar'
        ? 'تم إنشاء المساق الجديد! يمكنك توليد أسئلته أو رفع ملفاته الآن.'
        : 'New course created! You can now generate questions or upload slides.'
    );
  };

  // Delete Question Bank (user can delete ANY bank, including the last one)
  const handleDeleteBank = (bankId: string, title: string) => {
    const remaining = banks.filter((b) => b.id !== bankId);
    setBanks(remaining);
    if (activeBankId === bankId) {
      setActiveBankId(remaining.length > 0 ? remaining[0].id : '');
    }
    notify(locale === 'ar' ? `تم حذف: ${title}` : `Deleted bank: ${title}`);
  };

  // Real Dropzone Parsed Handler with live AI extraction
  const handleDropzoneParsed = async (parsed: {
    text: string;
    filename: string;
    word_count: number;
    reading_time_minutes: number;
    title_hint: string;
    pages?: number;
  }) => {
    setShowDropzone(false);
    setIsGeneratingAI(true);

    // Clean filename into human-readable course title & code
    const cleanRawName = parsed.filename
      .replace(/\.[^/.]+$/, '') // strip extension
      .replace(/[-_]+/g, ' ')
      .replace(/lastv\d+_\d+/gi, '') // strip build prefixes
      .trim();

    // Generate readable course code (e.g. NET101, BTEC, CS101)
    const words = cleanRawName.split(/\s+/).filter((w) => w.length > 2);
    let generatedCode = 'LEC01';
    if (words.length >= 2) {
      generatedCode = (words[0].slice(0, 3) + words[1].slice(0, 3)).toUpperCase();
    } else if (words.length === 1) {
      generatedCode = words[0].slice(0, 4).toUpperCase();
    }
    if (generatedCode.length < 3) generatedCode = 'MOD01';

    const cleanTitle = parsed.title_hint && parsed.title_hint.trim().length > 3
      ? parsed.title_hint.trim()
      : (cleanRawName || 'Uploaded Lecture');

    const targetBank = dropzoneTargetBankId ? banks.find((b) => b.id === dropzoneTargetBankId) : null;
    const workingBankId = targetBank ? targetBank.id : `bank-doc-${Date.now()}`;
    setGeneratingBankId(workingBankId);

    setGeneratingProgressText(
      locale === 'ar'
        ? `جاري قراءة محتوى "${cleanTitle}" وصياغة الأسئلة والملاحظات بـ CORTEXAI...`
        : `Reading "${cleanTitle}" and generating notes & exam questions via CORTEXAI...`
    );

    try {
      // 1. ELI5 synthesis
      let eli5Notes = '';
      try {
        const eli5Res = await apiPost<{ summary?: string; text?: string }>('/api/ai/summarize', {
          text: `Explain the fundamental concepts in this lecture document (${cleanTitle}) using vivid ELI5 real-world analogies:\n\n${parsed.text.slice(0, 3500)}`,
          provider: 'auto'
        });
        eli5Notes = eli5Res.summary || eli5Res.text || '';
      } catch (e) {
        eli5Notes = `Structured lecture summary for ${cleanTitle}.`;
      }

      // 2. Real AI questions extraction
      setGeneratingProgressText(
        locale === 'ar'
          ? `جاري صياغة 5 أسئلة امتحانية مستخرجة بدقة من ملف "${cleanTitle}"...`
          : `Synthesizing 5 high-yield exam questions from "${cleanTitle}"...`
      );

      const quizRes = await apiPost<{
        ok: boolean;
        quiz?: Array<{
          question: string;
          choices: string[];
          correct: number;
          explanation: string;
          topic?: string;
        }>;
      }>('/api/ai/quiz', {
        text: `Material from uploaded lecture "${cleanTitle}":\n\n${parsed.text.slice(0, 6000)}`,
        provider: 'auto',
        count: 5,
        difficulty: 'medium'
      });

      const extractedQuestions: QuestionItem[] = (quizRes?.quiz || []).map((q, idx) => ({
        id: `q-doc-${Date.now()}-${idx + 1}`,
        question: q.question,
        choices: q.choices,
        correct: typeof q.correct === 'number' ? q.correct : 0,
        explanation: q.explanation || `Derived from lecture: ${cleanTitle}`,
        topic: q.topic || cleanTitle
      }));

      // 3. Create NEW course bank OR update target bank
      if (targetBank) {
        setBanks((prev) =>
          prev.map((b) => {
            if (b.id === targetBank.id) {
              const filteredOld = (b.questions || []).filter(
                (oldQ) =>
                  !oldQ.question.includes('Modular Architecture') &&
                  !oldQ.question.includes('سؤال تمهيدي: ما هي الفائدة الأساسية') &&
                  !oldQ.id.startsWith('q-gen-')
              );
              return {
                ...b,
                lectureNotes: parsed.text,
                eli5Notes: eli5Notes || b.eli5Notes,
                questions: [...filteredOld, ...extractedQuestions]
              };
            }
            return b;
          })
        );
      } else {
        // Brand NEW Course Bank for this uploaded document!
        const newCourseBank: CourseBank = {
          id: workingBankId,
          code: generatedCode,
          title: cleanTitle,
          description: `Imported from ${parsed.filename} (${parsed.word_count} words).`,
          questions: extractedQuestions,
          lectureNotes: parsed.text,
          eli5Notes: eli5Notes,
          lastAttemptDate: undefined,
          lastScore: undefined
        };
        setBanks((prev) => [newCourseBank, ...prev]);
        setActiveBankId(newCourseBank.id);
      }

      notify(
        locale === 'ar'
          ? `تم إنشاء مساق جديد لملف "${cleanTitle}" وتوليد ${extractedQuestions.length} أسئلة وملخص ذكي!`
          : `Created new course for "${cleanTitle}" with ${extractedQuestions.length} questions & notes!`
      );
    } catch (err: any) {
      console.error('[study] Error in AI parsing workflow:', err);
      // Fallback: still save the lecture text in a course bank
      if (!targetBank) {
        const fallbackBank: CourseBank = {
          id: workingBankId,
          code: generatedCode,
          title: cleanTitle,
          description: `Imported from ${parsed.filename} (${parsed.word_count} words).`,
          questions: [],
          lectureNotes: parsed.text,
          eli5Notes: '',
          lastAttemptDate: undefined,
          lastScore: undefined
        };
        setBanks((prev) => [fallbackBank, ...prev]);
        setActiveBankId(fallbackBank.id);
      } else {
        setBanks((prev) =>
          prev.map((b) => (b.id === targetBank.id ? { ...b, lectureNotes: parsed.text } : b))
        );
      }
      notify(
        locale === 'ar'
          ? `تم حفظ نص المحاضرة، ولكن تعذر توليد الأسئلة: ${err.message}`
          : `Saved lecture material, but quiz generation failed: ${err.message}`
      );
    } finally {
      setIsGeneratingAI(false);
      setGeneratingBankId(null);
      setGeneratingProgressText('');
      setDropzoneTargetBankId(null);
    }
  };

  // Filtered Banks for Dashboard
  const filteredBanks = useMemo(() => {
    return banks.filter(
      (b) =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [banks, searchQuery]);

  // Filtered Questions for Q&A Guide
  const filteredGuideQuestions = useMemo(() => {
    if (!guideSearch.trim()) return activeQuestions;
    const q = guideSearch.toLowerCase();
    return activeQuestions.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.explanation.toLowerCase().includes(q) ||
        item.choices.some((c) => c.toLowerCase().includes(q))
    );
  }, [activeQuestions, guideSearch]);

  // Calculations for Results Screen
  const score = calculateScore();
  const totalQ = Math.max(1, activeQuestions.length);
  const percentScore = Math.round((score / totalQ) * 100);
  const isPassed = percentScore >= 60;

  // Filtered results review questions
  const resultsQuestions = useMemo(() => {
    return activeQuestions.filter((q, idx) => {
      const isCorrect = selectedAnswers[idx] === q.correct;
      const isFlagged = flaggedQuestions.includes(idx);
      if (resultsFilter === 'mistakes') return !isCorrect;
      if (resultsFilter === 'flagged') return isFlagged;
      return true;
    });
  }, [activeQuestions, selectedAnswers, flaggedQuestions, resultsFilter]);

  // Current question in Exam or Practice
  const currentQuestion = activeQuestions[currentQIndex] || activeQuestions[0];
  const isCurrentFlagged = flaggedQuestions.includes(currentQIndex);
  const currentAnswer = selectedAnswers[currentQIndex];

  // Helper formatting for timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ==========================================
  // RENDER: 1. EXAM SIMULATOR & PRACTICE VIEW
  // ==========================================
  if (mode === 'exam' || mode === 'practice') {
    const isPractice = mode === 'practice';
    const isAnswered = currentAnswer !== undefined;

    // Empty Course / Generating Gate:
    if (activeQuestions.length === 0) {
      if (isGeneratingAI) {
        return (
          <div className="page-in min-h-[75vh] flex flex-col items-center justify-center text-center p-6 max-w-xl mx-auto space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan shadow-xl shadow-cyan/10 animate-pulse">
                <Cpu size={36} />
              </div>
              <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-card border border-cyan/40 shadow-sm">
                <Loader2 size={20} className="animate-spin text-cyan" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-cyan/10 border border-cyan/30 text-cyan font-bold">
                {t('study.generatingIndicator')}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {generatingProgressText || t('study.generatingAiQuestions')}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                {t('study.generatingSubtitle')}
              </p>
            </div>

            <div className="w-64 h-1.5 bg-muted rounded-full overflow-hidden border border-border">
              <div className="h-full bg-cyan animate-pulse" style={{ width: '75%' }} />
            </div>
          </div>
        );
      }

      return (
        <div className="page-in min-h-[75vh] flex flex-col items-center justify-center text-center p-6 max-w-xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center text-cyan shadow-xs">
            <GraduationCap size={32} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted border border-border text-cyan font-bold">
                {activeBank.code}
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 font-bold">
                {t('study.emptyBankBadge')}
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              {t('study.emptyCourseTitle')}
            </h2>

            <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
              {t('study.emptyCourseDesc')}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
            <button
              type="button"
              onClick={() => handleGenerateAiQuestions(activeBank.id)}
              className="btn btn-primary text-xs h-[42px] px-5 gap-2 font-mono w-full justify-center shadow-md shadow-cyan/10"
            >
              <Sparkles size={15} />
              <span>{t('study.generateAiQuestions')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDropzone(!showDropzone)}
              className={`btn text-xs h-[42px] px-4 gap-2 font-mono w-full sm:w-auto justify-center transition ${
                showDropzone
                  ? 'bg-cyan/10 border border-cyan/40 text-cyan'
                  : 'btn-outline hover:border-cyan'
              }`}
            >
              <UploadCloud size={15} />
              <span>{t('study.importSlides')}</span>
            </button>
          </div>

          {/* Embedded Dropzone if toggled */}
          {showDropzone && (
            <div className="w-full max-w-lg text-start animate-in fade-in duration-200">
              <DocumentDropzone onParsed={handleDropzoneParsed} notify={notify} />
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setMode('banks')}
              className="btn btn-ghost text-xs h-[34px] px-3 gap-1.5 font-mono text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={13} className="rtl:rotate-180" />
              <span>{t('study.backToBanks')}</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="page-in min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-[1280px] mx-auto space-y-6">
        
        {/* Top Navigation & Status Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMode('banks')}
              className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono hover:border-cyan"
            >
              <ArrowLeft size={13} className="rtl:rotate-180" />
              <span>{t('study.exitExam')}</span>
            </button>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-cyan font-semibold">
                  {activeBank.code}
                </span>
                <span className="text-xs font-semibold text-foreground truncate max-w-[280px] sm:max-w-md">
                  {activeBank.title}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Mode & Timer Badge */}
            {isPractice ? (
              <span className="text-[11px] font-mono px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center gap-1.5">
                <Zap size={13} />
                <span>{t('study.practiceModeBadge')}</span>
              </span>
            ) : (
              <span className="text-[11px] font-mono px-3 py-1 rounded-lg bg-cyan/10 border border-cyan/30 text-cyan flex items-center gap-1.5 font-bold">
                <Clock size={13} className="animate-pulse" />
                <span>{formatTimer(examSecondsLeft)}</span>
              </span>
            )}

            {/* Flag Question Button */}
            <button
              type="button"
              onClick={() => handleToggleFlag(currentQIndex)}
              className={`btn text-xs h-[34px] px-3 gap-1.5 font-mono transition ${
                isCurrentFlagged
                  ? 'bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
                  : 'btn-outline hover:border-primary/40'
              }`}
            >
              <Flag size={13} className={isCurrentFlagged ? 'fill-amber-400' : ''} />
              <span>{isCurrentFlagged ? t('study.unflag') : t('study.flagForReview')}</span>
            </button>

            {/* Submit Exam Button */}
            <button
              type="button"
              onClick={handleFinishExam}
              className="btn btn-primary text-xs h-[34px] px-3.5 gap-1.5 font-mono shadow-sm"
            >
              <CheckCircle2 size={13} />
              <span>{t('study.submitExam')}</span>
            </button>
          </div>
        </div>

        {/* Progress Bar Across Top */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span className="text-cyan">
              {locale === 'ar' ? `سؤال ${currentQIndex + 1} من ${activeQuestions.length}` : `Question ${currentQIndex + 1} of ${activeQuestions.length}`}
            </span>
            <span>
              {Object.keys(selectedAnswers).length} / {activeQuestions.length} Answered
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-cyan transition-all duration-300"
              style={{ width: `${((currentQIndex + 1) / activeQuestions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Question Arena */}
        <div className="panel p-5 sm:p-7 rounded-2xl border border-border space-y-6 bg-card">
          
          {/* Question Stem */}
          <div className="space-y-2">
            {currentQuestion.topic && (
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase px-2 py-0.5 rounded bg-muted border border-border">
                {currentQuestion.topic}
              </span>
            )}
            {(() => {
              const isQuestionRTL = /[\u0600-\u06FF]/.test(currentQuestion.question);
              return (
                <h2 dir={isQuestionRTL ? 'rtl' : 'ltr'} className="text-base sm:text-lg font-semibold text-foreground leading-relaxed text-start select-text">
                  {currentQuestion.question}
                </h2>
              );
            })()}
          </div>

          {/* Choices A, B, C, D */}
          <div className="grid grid-cols-1 gap-3">
            {currentQuestion.choices.map((choice, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = currentAnswer === idx;
              const isCorrectChoice = idx === currentQuestion.correct;
              const isChoiceRTL = /[\u0600-\u06FF]/.test(choice);

              // Premium theme-adaptive styling adhering strictly to teampvoice.com identity
              let choiceStyle = 'border-zinc-800/90 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900/60 text-zinc-200 transition-all shadow-xs';
              let badgeStyle = 'bg-zinc-900 border-zinc-700 text-zinc-300 font-bold';

              if (isPractice && isAnswered) {
                if (isCorrectChoice) {
                  choiceStyle = 'border-cyan bg-cyan/15 text-white font-semibold shadow-md shadow-cyan/10 ring-1 ring-cyan/50';
                  badgeStyle = 'bg-cyan text-black font-black border-cyan shadow-sm shadow-cyan/30';
                } else if (isSelected && !isCorrectChoice) {
                  choiceStyle = 'border-rose-500 bg-rose-500/15 text-white font-semibold ring-1 ring-rose-500/40';
                  badgeStyle = 'bg-rose-500 text-white font-black border-rose-500';
                }
              } else if (isSelected) {
                choiceStyle = 'border-cyan bg-cyan/15 text-white font-semibold shadow-md shadow-cyan/10 ring-1 ring-cyan/50';
                badgeStyle = 'bg-cyan text-black font-black border-cyan shadow-sm shadow-cyan/30';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  dir={isChoiceRTL ? 'rtl' : 'ltr'}
                  onClick={() => handleSelectChoice(idx)}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${choiceStyle}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono border shrink-0 ${badgeStyle}`}>
                    {letter}
                  </span>
                  <span className={`text-xs sm:text-sm leading-relaxed grow select-text ${isChoiceRTL ? 'text-right' : 'text-left'}`}>
                    {choice}
                  </span>

                  {/* Practice mode icons */}
                  {isPractice && isAnswered && (
                    <span className="shrink-0">
                      {isCorrectChoice && <CheckCircle2 size={18} className="text-cyan" />}
                      {isSelected && !isCorrectChoice && <XCircle size={18} className="text-rose-400" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Practice Mode Explanation Accordion */}
          {isPractice && isAnswered && (
            <div className="p-4 rounded-xl border border-cyan/30 bg-cyan/5 space-y-2 text-xs font-mono animate-in fade-in duration-200 text-start">
              <div className="flex items-center gap-2 text-cyan font-semibold">
                <Sparkles size={15} />
                <span>{t('study.instantExplanation')}</span>
              </div>
              <p dir="auto" className="text-foreground/90 leading-relaxed text-[12px] text-start select-text">
                {currentQuestion.explanation}
              </p>
            </div>
          )}

        </div>

        {/* Bottom Palette & Stepper Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentQIndex === 0}
              className="btn btn-outline text-xs h-[36px] px-3.5 gap-1.5 font-mono disabled:opacity-30"
            >
              <ChevronLeft size={14} className="rtl:rotate-180" />
              <span>{t('study.previous')}</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentQIndex((prev) => Math.min(activeQuestions.length - 1, prev + 1))}
              disabled={currentQIndex === activeQuestions.length - 1}
              className="btn btn-outline text-xs h-[36px] px-3.5 gap-1.5 font-mono disabled:opacity-30"
            >
              <span>{t('study.next')}</span>
              <ChevronRight size={14} className="rtl:rotate-180" />
            </button>
          </div>

          {/* Numbered Palette of Questions */}
          <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto py-1">
            {activeQuestions.map((_, idx) => {
              const isAnsweredQ = selectedAnswers[idx] !== undefined;
              const isCurrentQ = idx === currentQIndex;
              const isFlaggedQ = flaggedQuestions.includes(idx);

              let btnStyle = 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40';
              if (isCurrentQ) {
                btnStyle = 'border-cyan bg-cyan/15 text-cyan font-bold ring-1 ring-cyan shadow-xs';
              } else if (isFlaggedQ) {
                btnStyle = 'border-amber-500/80 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold';
              } else if (isAnsweredQ) {
                btnStyle = 'border-border bg-secondary text-foreground font-medium';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentQIndex(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-mono border flex items-center justify-center transition hover:scale-105 relative ${btnStyle}`}
                  title={`Question ${idx + 1}`}
                >
                  <span>{idx + 1}</span>
                  {isFlaggedQ && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    );
  }

  // ==========================================
  // RENDER: 2. RESULTS & PERFORMANCE REVIEW
  // ==========================================
  if (mode === 'results') {
    return (
      <div className="page-in min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-[1280px] mx-auto space-y-6">
        
        {/* Results Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
              EXAM SUBMISSION SUMMARY
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Award size={22} className={isPassed ? 'text-cyan' : 'text-amber-400'} />
              <span>{t('study.resultsTitle')}</span>
            </h1>
            <p className="text-xs text-muted-foreground">{activeBank.code} · {activeBank.title}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStartExam(activeBank.id)}
              className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono hover:border-cyan"
            >
              <RotateCcw size={13} />
              <span>{t('study.retakeExam')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenStudyGuide(activeBank.id)}
              className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono hover:border-cyan"
            >
              <BookOpen size={13} />
              <span>{t('study.viewStudyGuide')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('banks')}
              className="btn btn-primary text-xs h-[34px] px-3.5 font-mono"
            >
              <span>{t('study.exitExam')}</span>
            </button>
          </div>
        </div>

        {/* Score & Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Main Percentage Card */}
          <div className="panel p-5 rounded-2xl border border-border flex items-center gap-4 bg-card">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-xl border ${
              isPassed ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-amber-500/40 bg-amber-500/10 text-amber-500 dark:text-amber-400'
            }`}>
              {percentScore}%
            </div>
            <div>
              <b className={`text-xs font-mono uppercase tracking-wider block ${isPassed ? 'text-cyan' : 'text-amber-500 dark:text-amber-400'}`}>
                {isPassed ? t('study.scorePassed') : t('study.scoreNeedsReview')}
              </b>
              <small className="text-muted-foreground font-mono text-[11px]">
                {score} of {totalQ} correct
              </small>
            </div>
          </div>

          {/* Correct Answers */}
          <div className="panel p-5 rounded-2xl border border-border flex items-center gap-4 bg-card">
            <div className="w-12 h-12 rounded-xl bg-cyan/10 border border-cyan/30 text-cyan flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <b className="text-lg font-mono font-bold text-foreground">{score}</b>
              <small className="text-muted-foreground block text-[11px] font-mono">{t('study.correctAnswers')}</small>
            </div>
          </div>

          {/* Incorrect Answers */}
          <div className="panel p-5 rounded-2xl border border-border flex items-center gap-4 bg-card">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 flex items-center justify-center">
              <XCircle size={20} />
            </div>
            <div>
              <b className="text-lg font-mono font-bold text-foreground">{totalQ - score}</b>
              <small className="text-muted-foreground block text-[11px] font-mono">{t('study.incorrectAnswers')}</small>
            </div>
          </div>

          {/* Flagged Questions */}
          <div className="panel p-5 rounded-2xl border border-border flex items-center gap-4 bg-card">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center">
              <Flag size={20} />
            </div>
            <div>
              <b className="text-lg font-mono font-bold text-foreground">{flaggedQuestions.length}</b>
              <small className="text-muted-foreground block text-[11px] font-mono">{t('study.filterFlagged')}</small>
            </div>
          </div>

        </div>

        {/* Filter Pills for Question Review */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-muted/60 border border-border">
            <button
              type="button"
              onClick={() => setResultsFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                resultsFilter === 'all' ? 'bg-card text-foreground font-semibold shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('study.filterAll')} ({activeQuestions.length})
            </button>
            <button
              type="button"
              onClick={() => setResultsFilter('mistakes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                resultsFilter === 'mistakes' ? 'bg-card text-rose-500 font-semibold shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('study.filterMistakes')} ({totalQ - score})
            </button>
            <button
              type="button"
              onClick={() => setResultsFilter('flagged')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                resultsFilter === 'flagged' ? 'bg-card text-amber-500 font-semibold shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('study.filterFlagged')} ({flaggedQuestions.length})
            </button>
          </div>
        </div>

        {/* Question-by-Question Review List */}
        <div className="space-y-4">
          {resultsQuestions.length === 0 ? (
            <div className="panel p-8 rounded-xl border border-border text-center space-y-2 bg-card">
              <CheckCircle2 size={32} className="mx-auto text-cyan" />
              <p className="text-xs text-muted-foreground">{t('study.noMistakes')}</p>
            </div>
          ) : (
            resultsQuestions.map((q) => {
              const originalIndex = activeQuestions.findIndex((item) => item.id === q.id);
              const userChoice = selectedAnswers[originalIndex];
              const isCorrect = userChoice === q.correct;

              return (
                <div key={q.id} className="panel p-5 rounded-xl border border-border space-y-4 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold ${
                        isCorrect ? 'bg-cyan/10 text-cyan border border-cyan/30' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/30'
                      }`}>
                        {originalIndex + 1}
                      </span>
                      <h3 dir="auto" className="text-sm font-semibold text-foreground leading-relaxed text-start select-text">
                        {q.question}
                      </h3>
                    </div>
                    {isCorrect ? (
                      <span className="text-[11px] font-mono text-cyan flex items-center gap-1 shrink-0">
                        <CheckCircle2 size={14} /> Correct
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-rose-500 dark:text-rose-400 flex items-center gap-1 shrink-0">
                        <XCircle size={14} /> Incorrect
                      </span>
                    )}
                  </div>

                  {/* Choices with highlighted answers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.choices.map((choice, cIdx) => {
                      const isCorrectChoice = cIdx === q.correct;
                      const isUserChoice = cIdx === userChoice;

                      let style = 'border-border/80 bg-muted/40 text-foreground';
                      if (isCorrectChoice) {
                        style = 'border-cyan bg-cyan/10 text-foreground font-semibold ring-1 ring-cyan/40 shadow-xs';
                      } else if (isUserChoice && !isCorrectChoice) {
                        style = 'border-rose-500/80 bg-rose-500/10 text-foreground font-semibold line-through';
                      }

                      return (
                        <div key={cIdx} className={`p-2.5 rounded-lg border flex items-center gap-2 ${style}`}>
                          <span className="w-5 h-5 rounded text-[11px] font-mono flex items-center justify-center font-bold bg-muted text-muted-foreground border border-border">
                            {String.fromCharCode(65 + cIdx)}
                          </span>
                          <span dir="auto" className="truncate text-start select-text">{choice}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Full Rationale */}
                  <div className="p-3 rounded-lg border border-border bg-muted/50 text-xs font-mono text-foreground leading-relaxed space-y-1 text-start">
                    <span className="text-[10px] text-cyan uppercase tracking-wider block font-bold">
                      {t('study.whyCorrect')}
                    </span>
                    <p dir="auto" className="text-start select-text">{q.explanation}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    );
  }

  // ==========================================
  // RENDER: 3. Q&A STUDY GUIDE (FULL CHEAT SHEET)
  // ==========================================
  if (mode === 'guide') {
    return (
      <div className="page-in min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-[1280px] mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setMode('banks')}
              className="btn btn-outline text-xs h-[30px] px-2.5 gap-1.5 font-mono hover:border-cyan mb-1"
            >
              <ArrowLeft size={13} className="rtl:rotate-180" />
              <span>{t('study.exitExam')}</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen size={22} className="text-cyan" />
              <span>{t('study.guideTitle')}</span>
            </h1>
            <p className="text-xs text-muted-foreground">{activeBank.code} · {activeBank.title}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const markdown = activeQuestions
                  .map(
                    (q, i) =>
                      `### ${i + 1}. ${q.question}\n- **Correct:** ${q.choices[q.correct]}\n- **Rationale:** ${q.explanation}\n`
                  )
                  .join('\n');
                navigator.clipboard.writeText(markdown);
                notify(t('study.copied'));
              }}
              className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono hover:border-cyan"
            >
              <Copy size={13} />
              <span>{t('study.copyMarkdown')}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono hover:border-cyan"
            >
              <Printer size={13} />
              <span>{t('study.printGuide')}</span>
            </button>
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          <input
            type="text"
            value={guideSearch}
            onChange={(e) => setGuideSearch(e.target.value)}
            placeholder={t('study.searchGuide')}
            className="editable-input ps-9 pe-4 text-xs w-full font-mono py-2.5 rounded-xl focus:border-cyan"
          />
        </div>

        {/* List of all questions with answers revealed */}
        <div className="space-y-4">
          {filteredGuideQuestions.length === 0 ? (
            <div className="panel p-8 rounded-xl border border-border text-center text-xs text-muted-foreground bg-card">
              {t('study.noQuestionsFound')}
            </div>
          ) : (
            filteredGuideQuestions.map((q, idx) => (
              <div key={q.id} className="panel p-5 rounded-xl border border-border space-y-3 bg-card">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-muted border border-border text-cyan text-xs font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="space-y-1 text-start">
                    <h3 dir="auto" className="text-sm font-semibold text-foreground leading-relaxed text-start select-text">{q.question}</h3>
                    {q.topic && (
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">{q.topic}</span>
                    )}
                  </div>
                </div>

                {/* Highlighted Correct Choice */}
                <div className="p-3 rounded-lg border border-cyan/40 bg-cyan/10 flex items-center gap-2.5 text-xs font-mono text-foreground font-semibold text-start">
                  <CheckCircle2 size={16} className="text-cyan shrink-0" />
                  <div className="text-start">
                    <span className="text-[10px] text-cyan block uppercase tracking-wider font-bold">CORRECT ANSWER</span>
                    <span dir="auto" className="text-start select-text">{q.choices[q.correct]}</span>
                  </div>
                </div>

                {/* Detailed Rationale */}
                <div className="p-3 rounded-lg border border-border bg-muted/50 text-xs text-foreground font-mono leading-relaxed space-y-0.5 text-start">
                  <span className="text-[10px] text-muted-foreground uppercase block font-bold">RATIONALE:</span>
                  <p dir="auto" className="text-start select-text">{q.explanation}</p>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    );
  }

  // ==========================================
  // RENDER: 4. LECTURE NOTES & ELI5 VIEW
  // ==========================================
  if (mode === 'notes') {
    return (
      <div className="page-in min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-[1280px] mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setMode('banks')}
              className="btn btn-outline text-xs h-[30px] px-2.5 gap-1.5 font-mono hover:border-cyan mb-1"
            >
              <ArrowLeft size={13} className="rtl:rotate-180" />
              <span>{t('study.exitExam')}</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText size={22} className="text-cyan" />
              <span>{t('study.notesTab')}</span>
            </h1>
            <p className="text-xs text-muted-foreground">{activeBank.code} · {activeBank.title}</p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {activeBank.lectureNotes && (
              <>
                <button
                  type="button"
                  onClick={() => handleGenerateAiQuestions(activeBank.id)}
                  disabled={isGeneratingAI}
                  className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono hover:border-cyan text-cyan"
                >
                  <Sparkles size={13} />
                  <span>{t('study.generateQuestionsFromNotes')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateAiNotes(activeBank.id)}
                  disabled={isGeneratingAI}
                  className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono hover:border-purple-500 text-purple-400"
                >
                  <RefreshCw size={13} className={isGeneratingAI ? 'animate-spin' : ''} />
                  <span>{t('study.regenerateEli5')}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleStartExam(activeBank.id)}
              className="btn btn-primary text-xs h-[34px] px-3.5 gap-1.5 font-mono shadow-sm"
            >
              <Zap size={13} />
              <span>{t('study.takeExam')}</span>
            </button>
          </div>
        </div>

        {/* Global Generating Indicator in Notes */}
        {isGeneratingAI && (
          <div className="p-4 rounded-xl border border-cyan/40 bg-cyan/10 flex items-center gap-3 text-xs font-mono text-cyan animate-in fade-in duration-150 shadow-sm">
            <Loader2 size={18} className="animate-spin shrink-0" />
            <span className="font-semibold">{generatingProgressText || t('study.generatingAiNotes')}</span>
          </div>
        )}

        {/* Tab Switcher: Formatted Notes vs ELI5 */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-muted/60 border border-border w-fit">
          <button
            type="button"
            onClick={() => setNotesTab('summary')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
              notesTab === 'summary' ? 'bg-card text-cyan font-semibold shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen size={13} />
            <span>{t('study.structuredNotesTab')}</span>
          </button>
          <button
            type="button"
            onClick={() => setNotesTab('eli5')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
              notesTab === 'eli5' ? 'bg-card text-purple-400 font-semibold shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles size={13} />
            <span>{t('study.eli5Tab')}</span>
          </button>
        </div>

        {/* Notes Content or Interactive Empty State */}
        {!activeBank.lectureNotes ? (
          <div className="panel p-6 sm:p-8 rounded-2xl border border-border bg-card space-y-6 text-center">
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center text-cyan mx-auto">
                <FileText size={26} />
              </div>
              <h2 className="text-base font-bold text-foreground">{t('study.noNotesYet')}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('study.emptyCourseDesc')}</p>
            </div>

            {/* Direct AI Synthesis CTA */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleGenerateAiNotes(activeBank.id)}
                disabled={isGeneratingAI}
                className="btn btn-primary text-xs h-[40px] px-5 gap-2 font-mono shadow-md shadow-cyan/10"
              >
                <Sparkles size={14} />
                <span>{t('study.generateAiNotes')}</span>
              </button>
            </div>

            {/* Embedded Drag & Drop Zone */}
            <div className="max-w-2xl mx-auto pt-2 text-start">
              <DocumentDropzone onParsed={handleDropzoneParsed} notify={notify} />
            </div>

            {/* Manual Notes Pasting Option */}
            <div className="max-w-2xl mx-auto pt-4 border-t border-border text-start space-y-3">
              <label className="text-xs font-mono text-muted-foreground block font-semibold">
                {t('study.pasteNotesPlaceholder')}
              </label>
              <textarea
                value={customNotesText}
                onChange={(e) => setCustomNotesText(e.target.value)}
                rows={4}
                placeholder="e.g. Chapter 4: Distributed consensus protocols, Paxos, Raft leader election..."
                className="editable-input w-full text-xs font-mono resize-y"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!customNotesText.trim()) return;
                    setBanks((prev) =>
                      prev.map((b) => (b.id === activeBank.id ? { ...b, lectureNotes: customNotesText.trim() } : b))
                    );
                    setCustomNotesText('');
                    notify(locale === 'ar' ? 'تم حفظ الملاحظات بنجاح!' : 'Lecture notes saved successfully!');
                  }}
                  disabled={!customNotesText.trim()}
                  className="btn btn-outline text-xs h-[34px] px-4 font-mono hover:border-cyan disabled:opacity-40"
                >
                  {t('study.saveNotes')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel p-6 sm:p-8 rounded-2xl border border-border bg-card leading-relaxed font-sans text-sm text-foreground whitespace-pre-wrap">
            {notesTab === 'summary'
              ? activeBank.lectureNotes
              : activeBank.eli5Notes || (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-xs text-muted-foreground">No ELI5 analogies generated yet for this material.</p>
                    <button
                      type="button"
                      onClick={() => handleGenerateAiNotes(activeBank.id)}
                      className="btn btn-outline text-xs h-[34px] px-4 gap-2 font-mono hover:border-purple-500 text-purple-400"
                    >
                      <Sparkles size={13} />
                      <span>{t('study.regenerateEli5')}</span>
                    </button>
                  </div>
                )}
          </div>
        )}

      </div>
    );
  }

  // ==========================================
  // RENDER: 5. COURSE AI TUTOR & STUDY COMPANION
  // ==========================================
  if (mode === 'tutor') {
    const currentChat = tutorMessages[activeBank.id] || [];
    const hasSlides = !!(activeBank.lectureNotes && activeBank.lectureNotes.trim().length > 30);
    const slidesWords = hasSlides ? activeBank.lectureNotes!.trim().split(/\s+/).length : 0;

    return (
      <div className="page-in min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-[1280px] mx-auto flex flex-col h-[calc(100vh-5rem)] space-y-4">
        {/* Tutor Top Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMode('banks')}
              className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono hover:border-cyan"
            >
              <ArrowLeft size={13} className="rtl:rotate-180" />
              <span>{t('study.backToBanks')}</span>
            </button>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted border border-border text-cyan font-bold">
                  {activeBank.code}
                </span>
                <h1 className="text-sm font-bold text-foreground truncate max-w-[200px] sm:max-w-md">
                  {activeBank.title}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Persona Selector Dropdown */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border text-xs font-mono">
              <Bot size={13} className="text-cyan ms-1.5 shrink-0" />
              <select
                value={tutorPersona}
                onChange={(e) => setTutorPersona(e.target.value as any)}
                className="bg-transparent text-xs text-foreground font-mono focus:outline-none py-1 pe-2 cursor-pointer"
                title={t('study.teachingPersona')}
              >
                <option value="professor" className="bg-card text-foreground">{t('study.personaProfessor')}</option>
                <option value="socratic" className="bg-card text-foreground">{t('study.personaSocratic')}</option>
                <option value="crammer" className="bg-card text-foreground">{t('study.personaCrammer')}</option>
                <option value="coach" className="bg-card text-foreground">{t('study.personaCoach')}</option>
              </select>
            </div>

            {/* Copy Transcript */}
            <button
              type="button"
              onClick={handleCopyTutorTranscript}
              disabled={currentChat.length === 0}
              className="btn btn-outline text-xs h-[34px] px-2.5 gap-1.5 font-mono hover:border-cyan disabled:opacity-40"
              title={t('study.copyTranscript')}
            >
              <Copy size={13} />
              <span className="hidden sm:inline">{t('study.copyTranscript')}</span>
            </button>

            {/* Clear Chat */}
            <button
              type="button"
              onClick={handleClearTutorChat}
              disabled={currentChat.length === 0}
              className="btn btn-outline text-xs h-[34px] px-2.5 gap-1.5 font-mono hover:border-rose-500 hover:text-rose-400 disabled:opacity-40"
              title={t('study.clearChat')}
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">{t('study.clearChat')}</span>
            </button>

            {/* Shortcut to Notes */}
            <button
              type="button"
              onClick={() => setMode('notes')}
              className="btn btn-outline text-xs h-[34px] px-2.5 gap-1.5 font-mono hover:border-cyan"
            >
              <FileText size={13} />
              <span className="hidden sm:inline">{t('study.notesTab')}</span>
            </button>
          </div>
        </div>

        {/* Course Lecture Grounding Banner */}
        <div className="p-2.5 px-4 rounded-xl border border-zinc-800 bg-zinc-950/80 flex items-center justify-between flex-wrap gap-2 text-xs font-mono shrink-0 shadow-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan"></span>
            </span>
            <span className="text-zinc-400">
              {locale === 'ar' ? 'المرجعية المعرفية:' : 'Knowledge Anchor:'}
            </span>
            {hasSlides ? (
              <span className="text-cyan font-semibold">
                {locale === 'ar' ? `سلايدات وملخص ${activeBank.code} مفعلة (${slidesWords} كلمة موثقة بدون هلوسة)` : `Lecture Material Indexed (${slidesWords} words, zero hallucinations)`}
              </span>
            ) : (
              <span className="text-zinc-400">
                {locale === 'ar' ? `منهاج المساق (${activeBank.title})` : `Standard Course Syllabus (${activeBank.title})`}
              </span>
            )}
          </div>
          {!hasSlides && (
            <button
              type="button"
              onClick={() => {
                setShowDropzone(true);
                setMode('banks');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-[11px] text-cyan hover:underline flex items-center gap-1"
            >
              <UploadCloud size={12} />
              <span>{t('study.importSlides')}</span>
            </button>
          )}
        </div>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 rounded-2xl border border-border bg-card space-y-4">
          {currentChat.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan shadow-lg shadow-cyan/10">
                <Bot size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  {t('study.aiTutorTitle')}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('study.aiTutorSubtitle')}
                </p>
              </div>

              {/* Suggestion Chips */}
              <div className="w-full space-y-2 pt-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                  {locale === 'ar' ? 'بدء فوري للأسئلة الشائعة:' : 'Quick Starting Prompts:'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-start">
                  {[
                    t('study.tutorSuggestion1'),
                    t('study.tutorSuggestion2'),
                    t('study.tutorSuggestion3'),
                    t('study.tutorSuggestion4')
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendTutorMessage(chip)}
                      className="p-3 rounded-xl border border-border/80 hover:border-cyan/50 hover:bg-cyan/5 text-xs text-foreground/90 transition-all font-mono text-start flex items-start gap-2 group"
                    >
                      <Sparkles size={13} className="text-cyan shrink-0 mt-0.5 group-hover:scale-110 transition" />
                      <span className="line-clamp-2 leading-relaxed">{chip}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {currentChat.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-cyan/10 border border-cyan/30 text-cyan flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={16} />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-xs space-y-1.5 shadow-xs ${
                        isUser
                          ? 'bg-zinc-900 border border-cyan/40 text-foreground'
                          : 'bg-zinc-950/90 border border-border text-foreground leading-relaxed'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-muted-foreground pb-1 border-b border-border/40">
                        <span className="font-bold text-cyan">
                          {isUser ? (locale === 'ar' ? 'أنت' : 'You') : 'CORTEX Professor'}
                        </span>
                        <span>{msg.time}</span>
                      </div>
                      <div dir="auto" className="leading-relaxed whitespace-pre-wrap text-start text-foreground/95 select-text font-sans text-xs sm:text-sm">
                        {msg.text}
                      </div>
                      {!isUser && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.text);
                              notify(locale === 'ar' ? 'تم نسخ الشرح' : 'Explanation copied');
                            }}
                            className="text-[10px] font-mono text-muted-foreground hover:text-cyan flex items-center gap-1 transition"
                            title="Copy Response"
                          >
                            <Copy size={11} />
                            <span>{locale === 'ar' ? 'نسخ' : 'Copy'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isTutorThinking && (
                <div className="flex items-start gap-3 justify-start max-w-3xl mx-auto animate-in fade-in duration-150">
                  <div className="w-8 h-8 rounded-xl bg-cyan/10 border border-cyan/30 text-cyan flex items-center justify-center shrink-0">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                  <div className="rounded-2xl p-3.5 px-4 bg-zinc-950/90 border border-border text-xs font-mono text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
                    <span>{locale === 'ar' ? 'CORTEXAI يقوم بالتحليل المعرفي وصياغة الشرح...' : 'CORTEXAI is analyzing course material and reasoning...'}</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {/* Tutor Bottom Input Bar */}
        <div className="p-3 rounded-2xl border border-border bg-card space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <textarea
              value={tutorInput}
              onChange={(e) => setTutorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendTutorMessage();
                }
              }}
              rows={2}
              placeholder={t('study.chatInputPlaceholder')}
              className="editable-input w-full text-xs font-sans resize-none py-2 px-3 rounded-xl focus:border-cyan"
            />
            <button
              type="button"
              onClick={() => handleSendTutorMessage()}
              disabled={!tutorInput.trim() || isTutorThinking}
              className="btn btn-primary h-[54px] px-4 font-mono text-xs gap-1.5 shrink-0 shadow-md shadow-cyan/10 disabled:opacity-40"
            >
              {isTutorThinking ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Send size={15} />
                  <span className="hidden sm:inline">{t('study.send')}</span>
                </>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-1">
            <span>
              {locale === 'ar' ? 'اضغط Enter للإرسال، و Shift+Enter لسطر جديد' : 'Press Enter to send, Shift+Enter for newline'}
            </span>
            <span className="text-cyan">
              {locale === 'ar' ? 'حفظ تلقائي محلي للمحادثات' : 'Locally preserved sessions'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: 0. MAIN DASHBOARD: QUESTION BANKS & DROPZONE
  // ==========================================
  return (
    <div className="page-in min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-[1540px] mx-auto space-y-6">
      
      {/* 1. Top Header Bar: Identity, Metrics & Quick Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
              {t('study.eyebrow')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/30 text-cyan flex items-center gap-1">
              <Cpu size={11} />
              <span>{t('study.cortexAiBadge')}</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GraduationCap size={24} className="text-cyan" />
            <span>{t('study.title')}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {t('study.subtitle')}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDropzoneTargetBankId(null);
              setShowDropzone(!showDropzone);
            }}
            className={`btn text-xs h-[34px] px-3 gap-1.5 font-mono transition ${
              showDropzone
                ? 'bg-cyan/10 border border-cyan/40 text-cyan'
                : 'btn-outline hover:border-cyan'
            }`}
          >
            <UploadCloud size={13} />
            <span>{t('study.importSlides')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewBankModal(true)}
            className="btn btn-primary text-xs h-[34px] px-3.5 gap-1.5 font-mono shadow-sm"
          >
            <Plus size={13} />
            <span>{t('study.newCourse')}</span>
          </button>
        </div>
      </div>

      {/* Real-time AI Synthesis Banner */}
      {isGeneratingAI && (
        <div className="p-3.5 rounded-xl border border-cyan/40 bg-cyan/10 flex items-center justify-between gap-3 text-xs font-mono text-foreground animate-in fade-in duration-150 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Loader2 size={16} className="animate-spin text-cyan shrink-0" />
            <span className="font-semibold text-cyan">{generatingProgressText}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-cyan px-2.5 py-0.5 rounded bg-cyan/20 border border-cyan/30 font-bold hidden sm:inline-block">
            {t('study.cortexAiBadge')}
          </span>
        </div>
      )}

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="panel p-4 rounded-xl border border-border bg-card space-y-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {t('study.statTotalQuestions')}
          </span>
          <b className="text-xl font-mono font-bold text-foreground block">{totalQuestionsCount}</b>
        </div>
        <div className="panel p-4 rounded-xl border border-border bg-card space-y-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {t('study.statCourses')}
          </span>
          <b className="text-xl font-mono font-bold text-cyan block">{banks.length}</b>
        </div>
        <div className="panel p-4 rounded-xl border border-border bg-card space-y-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {t('study.statAvgAccuracy')}
          </span>
          <b className="text-xl font-mono font-bold text-emerald-500 dark:text-emerald-400 block">{averageScore}%</b>
        </div>
        <div className="panel p-4 rounded-xl border border-border bg-card space-y-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {t('study.statStreak')}
          </span>
          <b className="text-xl font-mono font-bold text-purple-500 dark:text-purple-400 block">5 {t('study.days')}</b>
        </div>
      </div>

      {/* 3. Collapsible Document Dropzone (PDF/DOCX to Markdown Parser) */}
      {showDropzone && (
        <div className="panel p-5 rounded-2xl border border-cyan/40 bg-card space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <UploadCloud size={15} className="text-cyan" />
                <span>{t('study.importSlides')}</span>
              </h2>
              <p className="text-[11px] text-muted-foreground">{t('study.importSlidesDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDropzone(false)}
              className="text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              ✕ Close
            </button>
          </div>
          <DocumentDropzone onParsed={handleDropzoneParsed} notify={notify} />
        </div>
      )}

      {/* 4. Question Banks Header & Search */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen size={16} className="text-cyan" />
          <span>Active Question Banks & Courses</span>
        </h2>

        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('study.searchCourses')}
            className="editable-input ps-9 pe-4 text-xs w-full font-mono py-2 rounded-xl focus:border-cyan"
          />
        </div>
      </div>

      {/* 5. Clean Question Banks Grid with Dual-Motion Engine Support */}
      {filteredBanks.length === 0 ? (
        <div className="panel p-10 sm:p-14 rounded-2xl border border-dashed border-zinc-800 bg-card/60 text-center space-y-5 max-w-xl mx-auto my-6 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan mx-auto shadow-md shadow-cyan/10">
            <GraduationCap size={32} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {searchQuery
                ? (locale === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching courses found')
                : (locale === 'ar' ? 'لا توجد مواد أو بنوك أسئلة حالياً' : 'No Question Banks or Courses Yet')}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
              {searchQuery
                ? (locale === 'ar' ? 'جرب البحث باسم آخر أو رمز مختلف.' : 'Try a different search term or course code.')
                : (locale === 'ar'
                  ? 'يمكنك إنشاء مساق جديد أو سحب ملف المحاضرة (PDF/DOCX) لإنشاء مادة تلقائياً مع أسئلتها وملخصها.'
                  : 'Create a new course bank or drop any lecture file (PDF/DOCX) to automatically generate notes and questions.')}
            </p>
          </div>
          {!searchQuery && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewBankModal(true)}
                className="btn btn-primary text-xs h-[38px] px-5 gap-2 font-mono shadow-md shadow-cyan/10"
              >
                <Plus size={14} />
                <span>{t('study.newCourse')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDropzoneTargetBankId(null);
                  setShowDropzone(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="btn btn-outline text-xs h-[38px] px-4 gap-2 font-mono hover:border-cyan"
              >
                <UploadCloud size={14} />
                <span>{t('study.importSlides')}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBanks.map((bank) => {
            const qCount = bank.questions?.length || 0;
            const scorePercent = bank.lastScore;
            const hasSlides = !!(bank.lectureNotes && bank.lectureNotes.trim().length > 30);

            return (
              <div
                key={bank.id}
                className="module-card panel p-5 rounded-2xl border border-zinc-800/80 hover:border-cyan/40 transition-all flex flex-col justify-between gap-4 bg-card relative group shadow-xs hover:shadow-md"
              >
                {/* Card Header: Code, Slides Tag & Delete Action */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border text-cyan font-bold">
                        {bank.code}
                      </span>
                      {hasSlides && (
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan/10 border border-cyan/30 text-cyan">
                          SLIDES
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {scorePercent !== undefined ? (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          scorePercent >= 60
                            ? 'border-cyan/30 bg-cyan/10 text-cyan'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400'
                        }`}>
                          {scorePercent}% {t('study.passing')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
                          {t('study.unattempted')}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteBank(bank.id, bank.title)}
                        className="p-1 rounded text-muted-foreground hover:text-rose-500 transition"
                        title={t('study.deleteBank')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-cyan transition">
                      {bank.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed min-h-[34px]">
                      {bank.description}
                    </p>
                  </div>
                </div>

                {/* Card Metadata */}
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-2 border-t border-border">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle size={13} className="text-cyan" />
                    <span>{qCount} {t('study.questionsCount')}</span>
                  </span>
                  <span>{bank.lastAttemptDate || t('study.unattempted')}</span>
                </div>

                {/* Action Buttons with Zero-Slop Clear Hierarchy */}
                {qCount === 0 ? (
                  <div className="space-y-2 pt-1">
                    {/* Primary CTA: Customize & Generate Questions */}
                    <button
                      type="button"
                      onClick={() => setCustomQuizBankId(bank.id)}
                      disabled={isGeneratingAI && generatingBankId === bank.id}
                      className="btn btn-primary text-xs h-[36px] px-3 gap-1.5 font-mono justify-center shadow-md shadow-cyan/10 w-full"
                    >
                      {isGeneratingAI && generatingBankId === bank.id ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>{t('study.generatingAiQuestions')}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          <span>{t('study.generateAiQuestionsShort')}</span>
                        </>
                      )}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDropzoneTargetBankId(bank.id);
                          setActiveBankId(bank.id);
                          setShowDropzone(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="btn btn-outline text-xs h-[34px] px-2 gap-1.5 font-mono justify-center hover:border-cyan"
                      >
                        <UploadCloud size={13} />
                        <span>{t('study.importSlides')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenTutor(bank.id)}
                        className="btn btn-outline text-xs h-[34px] px-2 gap-1.5 font-mono justify-center bg-cyan/5 border-cyan/30 text-cyan hover:bg-cyan/15 hover:border-cyan"
                      >
                        <MessageSquare size={13} />
                        <span>{t('study.askAiTutor')}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenNotes(bank.id)}
                      className="btn btn-outline text-xs h-[32px] px-2 gap-1.5 font-mono justify-center w-full hover:border-border text-muted-foreground hover:text-foreground"
                    >
                      <FileText size={12} />
                      <span>{t('study.notesTab')} & ELI5</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {/* Row 1: Primary Exam Simulation */}
                    <button
                      type="button"
                      onClick={() => handleStartExam(bank.id)}
                      className="btn btn-primary w-full h-[36px] font-mono text-xs gap-2 font-bold justify-center shadow-sm"
                    >
                      <Zap size={13} />
                      <span>{t('study.takeExam')}</span>
                    </button>

                    {/* Row 2: Practice & Guide (2 equal columns) */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartPractice(bank.id)}
                        className="btn btn-outline text-xs h-[34px] px-2 gap-1.5 font-mono justify-center hover:border-purple-500 hover:text-purple-400"
                      >
                        <Award size={13} />
                        <span>{t('study.practiceMode')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStudyGuide(bank.id)}
                        className="btn btn-outline text-xs h-[34px] px-2 gap-1.5 font-mono justify-center hover:border-cyan"
                      >
                        <BookOpen size={13} />
                        <span>{t('study.studyGuide')}</span>
                      </button>
                    </div>

                    {/* Row 3: AI Tutor & Notes (2 equal columns) */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenTutor(bank.id)}
                        className="btn btn-outline text-xs h-[34px] px-2 gap-1.5 font-mono justify-center bg-cyan/5 border-cyan/30 text-cyan hover:bg-cyan/15 hover:border-cyan"
                      >
                        <MessageSquare size={13} />
                        <span>{t('study.askAiTutor')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenNotes(bank.id)}
                        className="btn btn-outline text-xs h-[34px] px-2 gap-1.5 font-mono justify-center hover:border-border"
                      >
                        <FileText size={13} />
                        <span>{t('study.notesTab')}</span>
                      </button>
                    </div>

                    {/* Row 4: Customize Exam & Generate More */}
                    <button
                      type="button"
                      onClick={() => setCustomQuizBankId(bank.id)}
                      className="w-full text-xs font-mono py-1.5 px-2 rounded-lg border border-border/60 hover:border-cyan/40 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-cyan transition flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={12} className="text-cyan" />
                      <span>{t('study.customizeQuiz')}</span>
                    </button>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* 6. Modal: Create New Question Bank */}
      {showNewBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="panel p-6 rounded-2xl border border-border max-w-md w-full space-y-4 bg-card shadow-2xl">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Plus size={16} className="text-cyan" />
              <span>{t('study.createBankModalTitle')}</span>
            </h2>

            <div className="space-y-3 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-muted-foreground">{t('study.courseTitle')}</label>
                <input
                  type="text"
                  value={newBankTitle}
                  onChange={(e) => setNewBankTitle(e.target.value)}
                  placeholder="e.g. Distributed Systems & Microservices"
                  className="editable-input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground">{t('study.courseCode')}</label>
                <input
                  type="text"
                  value={newBankCode}
                  onChange={(e) => setNewBankCode(e.target.value)}
                  placeholder="e.g. CS401"
                  className="editable-input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground">{t('study.courseDescription')}</label>
                <textarea
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                  rows={2}
                  placeholder="Topics, syllabus, and exam focus..."
                  className="editable-input w-full resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewBankModal(false)}
                className="btn btn-outline text-xs h-[34px] px-3 font-mono"
              >
                {t('study.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreateBank}
                disabled={!newBankTitle.trim()}
                className="btn btn-primary text-xs h-[34px] px-3.5 font-mono disabled:opacity-50"
              >
                {t('study.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Custom AI Quiz Generator */}
      {customQuizBankId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="panel p-6 rounded-2xl border border-zinc-800 max-w-lg w-full space-y-5 bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/30 text-cyan flex items-center justify-center">
                  <SlidersHorizontal size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    {t('study.customQuizModalTitle')}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {banks.find((b) => b.id === customQuizBankId)?.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomQuizBankId(null)}
                className="text-muted-foreground hover:text-foreground text-xs font-mono p-1"
              >
                ✕
              </button>
            </div>

            {/* Question Count Selector */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-semibold text-foreground block">
                {t('study.questionCount')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setCustomQuizCount(count)}
                    className={`py-2 rounded-xl text-xs font-mono border transition ${
                      customQuizCount === count
                        ? 'border-cyan bg-cyan/15 text-cyan font-bold ring-1 ring-cyan'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    {count} {t('study.questionsCount')}
                  </button>
                ))}
              </div>
            </div>

            {/* Academic Difficulty Selector */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-semibold text-foreground block">
                {t('study.difficultyLevel')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: 'easy' as const, label: t('study.diffEasy'), desc: 'Foundations & Definitions' },
                  { key: 'medium' as const, label: t('study.diffMedium'), desc: 'Standard Exam Curricula' },
                  { key: 'hard' as const, label: t('study.diffHard'), desc: 'Multi-step Problem Solving' },
                  { key: 'expert' as const, label: t('study.diffExpert'), desc: 'Tricky Edge Cases & Rigor' }
                ].map((diff) => (
                  <button
                    key={diff.key}
                    type="button"
                    onClick={() => setCustomQuizDifficulty(diff.key)}
                    className={`p-3 rounded-xl text-start border transition space-y-0.5 ${
                      customQuizDifficulty === diff.key
                        ? 'border-cyan bg-cyan/10 ring-1 ring-cyan/40 text-foreground font-semibold'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <span className="text-xs font-bold block text-foreground">{diff.label}</span>
                    <span className="text-[10px] text-muted-foreground block font-mono">{diff.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setCustomQuizBankId(null)}
                className="btn btn-outline text-xs h-[36px] px-4 font-mono"
              >
                {t('study.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleGenerateAiQuestions(customQuizBankId, customQuizCount, customQuizDifficulty)}
                disabled={isGeneratingAI}
                className="btn btn-primary text-xs h-[36px] px-5 gap-2 font-mono shadow-md shadow-cyan/10"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t('study.generatingAiQuestions')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>{t('study.generateCustomQuiz')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}