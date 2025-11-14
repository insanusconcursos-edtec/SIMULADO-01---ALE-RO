import React, { useState, useCallback, useEffect } from 'react';
import IdentificationForm from './components/IdentificationForm';
import AnswerSheet from './components/AnswerSheet';
import ResultsDisplay from './components/ResultsDisplay';
import Ranking from './components/Ranking';
import AdminView from './components/AdminView';
import AdminLogin from './components/AdminLogin';
import UserAppeals from './components/UserAppeals';
import { User, UserAnswers, Submission, AnswerOption, ApprovalStatus, Appeal } from './types';
import * as db from './services/db';
import { DBState } from './services/db';
import { DEFAULT_ADMIN_ANSWERS, POINTS_PART_1, POINTS_PART_2, SCORING_BREAKPOINT, MAX_POSSIBLE_SCORE, ADMIN_USERNAME, ADMIN_PASSWORD, TOTAL_QUESTIONS } from './constants';

type View = 'identification' | 'answersheet' | 'results' | 'ranking' | 'appeals';

interface LastSubmissionResult {
  score: number;
  rank: number;
  answers: UserAnswers;
  status: ApprovalStatus;
  reprovalReasons?: string[];
}

const calculateAge = (dobString: string): number => {
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
};

const calculateScoreAndStatus = (
    userAnswers: UserAnswers, 
    adminAnswers: Record<number, AnswerOption>
): {
    score: number;
    module1Score: number;
    module2Score: number;
    status: ApprovalStatus;
    reprovalReasons: string[];
} => {
    let correctModule1 = 0;
    let correctModule2 = 0;

    for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
        const qNumber = i;
        const userAnswer = userAnswers[qNumber];
        const correctAnswer = adminAnswers[qNumber];

        if (!userAnswer) continue; // Skip if user didn't answer

        const isModule1 = qNumber <= SCORING_BREAKPOINT;

        // Question is annulled ('X') OR user's answer is correct
        if (correctAnswer === 'X' || userAnswer === correctAnswer) {
            if (isModule1) {
                correctModule1++;
            } else {
                correctModule2++;
            }
        }
    }

    const module1Score = correctModule1 * POINTS_PART_1;
    const module2Score = correctModule2 * POINTS_PART_2;
    const score = module1Score + module2Score;
    const totalCorrect = correctModule1 + correctModule2;
    
    const reprovalReasons: string[] = [];
    if (correctModule1 < 12) {
        reprovalReasons.push('Não atingiu o mínimo de 12 acertos (30%) no Módulo I.');
    }
    if (correctModule2 < 16) {
        reprovalReasons.push('Não atingiu o mínimo de 16 acertos (40%) no Módulo II.');
    }
    if (totalCorrect < 32) {
        reprovalReasons.push('Não atingiu o mínimo de 32 acertos (40%) no total do gabarito.');
    }

    const status: ApprovalStatus = reprovalReasons.length > 0 ? 'REPROVADO' : 'APROVADO';

    return { score, module1Score, module2Score, status, reprovalReasons };
};

interface UserNavigationProps {
    currentView: View;
    onViewChange: (view: View) => void;
    onLogout: () => void;
}

const UserNavigation: React.FC<UserNavigationProps> = ({ currentView, onViewChange, onLogout }) => {
    const navItems: { view: View; label: string }[] = [
        { view: 'results', label: 'Resultados' },
        { view: 'ranking', label: 'Ranking' },
        { view: 'appeals', label: 'Recursos' },
    ];

    const baseClasses = "px-4 py-2 rounded-md font-semibold transition-colors duration-200";
    const activeClasses = "bg-primary text-white";
    const inactiveClasses = "bg-gray-200 text-textSecondary hover:bg-gray-300";

    return (
        <div className="w-full max-w-5xl bg-white rounded-xl shadow-md p-3 mb-8 flex flex-wrap justify-between items-center gap-4">
            <nav className="flex items-center space-x-2 sm:space-x-4">
                {navItems.map(item => (
                    <button
                        key={item.view}
                        onClick={() => onViewChange(item.view)}
                        className={`${baseClasses} ${currentView === item.view ? activeClasses : inactiveClasses}`}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
            <button
                onClick={onLogout}
                className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
            >
                Sair
            </button>
        </div>
    );
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<DBState | null>(null);
  
  const [view, setView] = useState<View>('identification');
  const [isAdminView, setIsAdminView] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [error, setError] = useState<string | null>(null);
  const [lastSubmissionResult, setLastSubmissionResult] = useState<LastSubmissionResult | null>(null);

  useEffect(() => {
    db.getData().then(setAppState);
  }, []);

  const updateAndPersistState = useCallback((updater: (prevState: DBState) => DBState) => {
    setAppState(prevState => {
        if (!prevState) return null;
        const newState = updater(prevState);
        db.setData(newState);
        return newState;
    });
  }, []);

  const handleIdentificationSubmit = useCallback((user: User) => {
    if (!appState) return;
    setError(null);
    const existingSubmissionByEmailOrCpf = appState.submissions.find(
      sub => sub.user.email === user.email || sub.user.cpf === user.cpf
    );

    if (existingSubmissionByEmailOrCpf) {
      setError('E-mail ou CPF já cadastrado. Não é permitido enviar novas respostas.');
      return;
    }
    
    const existingSubmissionByNickname = appState.submissions.find(
      sub => sub.user.nickname.toLowerCase() === user.nickname.toLowerCase()
    );

    if(existingSubmissionByNickname) {
        setError('Apelido já existe. Por favor, escolha outro.');
        return;
    }

    setCurrentUser(user);
    setView('answersheet');
  }, [appState]);

  const handleAnswersSubmit = useCallback(() => {
    if (!currentUser || !appState) return;

    updateAndPersistState(prev => {
        const { score, module1Score, module2Score, status, reprovalReasons } = calculateScoreAndStatus(userAnswers, prev.adminAnswers);
        const age = calculateAge(currentUser.dob);

        const newSubmission: Submission = { 
            user: currentUser, 
            score, 
            answers: userAnswers,
            status,
            reprovalReasons: status === 'REPROVADO' ? reprovalReasons : [],
            age,
            module1Score,
            module2Score
        };
        
        const updatedSubmissions = [...prev.submissions, newSubmission];
        
        const sortedSubmissions = [...updatedSubmissions].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const aIsSenior = a.age >= 60;
            const bIsSenior = b.age >= 60;
            if (aIsSenior && !bIsSenior) return -1;
            if (!aIsSenior && bIsSenior) return 1;
            if (aIsSenior && bIsSenior) return b.age - a.age;
            if (b.module2Score !== a.module2Score) return b.module2Score - a.module2Score;
            if (b.module1Score !== a.module1Score) return b.module1Score - a.module1Score;
            return b.age - a.age; // Older wins if all else is equal
        });

        const rank = sortedSubmissions.findIndex(sub => sub.user.cpf === currentUser.cpf) + 1;

        setLastSubmissionResult({ 
            score, 
            rank, 
            answers: userAnswers,
            status,
            reprovalReasons: status === 'REPROVADO' ? reprovalReasons : undefined
        });

        return { ...prev, submissions: updatedSubmissions };
    });

    setView('results');
  }, [currentUser, userAnswers, appState, updateAndPersistState]);
  
  const handleUserLogin = useCallback((cpf: string) => {
    if (!appState) return;
    setError(null);
    const submission = appState.submissions.find(sub => sub.user.cpf === cpf);

    if (submission) {
        const approvedSubs = appState.submissions.filter(s => s.status === 'APROVADO').sort((a,b) => b.score - a.score); // Simplified sort for rank
        const disapprovedSubs = appState.submissions.filter(s => s.status === 'REPROVADO').sort((a,b) => b.score - a.score);
        
        let rank = -1;
        if (submission.status === 'APROVADO') {
            rank = approvedSubs.findIndex(s => s.user.cpf === cpf) + 1;
        } else {
            rank = disapprovedSubs.findIndex(s => s.user.cpf === cpf) + 1;
        }
        
        setCurrentUser(submission.user);
        setLastSubmissionResult({
            score: submission.score,
            rank: rank,
            answers: submission.answers,
            status: submission.status,
            reprovalReasons: submission.reprovalReasons
        });
        setView('results');
    } else {
        setError('CPF não encontrado. Por favor, verifique o número digitado ou preencha o gabarito primeiro.');
    }
  }, [appState]);

  const handleStartOver = useCallback(() => {
    setCurrentUser(null);
    setUserAnswers({});
    setError(null);
    setLastSubmissionResult(null);
    setView('identification');
    setIsAdminView(false);
  }, []);
  
  const handleToggleAdminView = () => {
    handleStartOver();
    setIsAdminView(!isAdminView);
  };

  const handleAdminLogin = (username: string, password: string) => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        setIsAdminAuthenticated(true);
        setError(null);
    } else {
        setError("Usuário admin ou senha incorretos.");
    }
  };
  
  const recalculateAllSubmissions = useCallback((
    allSubmissions: Submission[], 
    currentAdminAnswers: Record<number, AnswerOption>
  ): Submission[] => {
      return allSubmissions.map(sub => {
          const { score, module1Score, module2Score, status, reprovalReasons } = calculateScoreAndStatus(sub.answers, currentAdminAnswers);
          return {
              ...sub,
              score,
              module1Score,
              module2Score,
              status,
              reprovalReasons: status === 'REPROVADO' ? reprovalReasons : [],
          };
      });
  }, []);

  const handleAdminAnswersSave = useCallback((newAnswers: Record<number, AnswerOption>) => {
      if (!appState) return;
      const recalculated = recalculateAllSubmissions(appState.submissions, newAnswers);
      updateAndPersistState(prev => ({
          ...prev,
          adminAnswers: newAnswers,
          submissions: recalculated,
      }));
      alert('Gabarito atualizado e todas as pontuações foram recalculadas!');
  }, [appState, recalculateAllSubmissions, updateAndPersistState]);

  const handleAppealSubmit = useCallback((appealData: Omit<Appeal, 'id' | 'createdAt' | 'status'>) => {
    const newAppeal: Appeal = {
        ...appealData,
        id: `appeal-${Date.now()}-${Math.random()}`,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
    };
    updateAndPersistState(prev => ({ ...prev, appeals: [...prev.appeals, newAppeal] }));
  }, [updateAndPersistState]);

  const handleProcessAppeal = useCallback((updatedAppeal: Appeal) => {
      let needsRecalculation = false;
      let newAdminAnswers = { ...appState!.adminAnswers };

      if (updatedAppeal.status === 'APPROVED' && updatedAppeal.adminDecision) {
          if (updatedAppeal.adminDecision === 'ANNUL_QUESTION') {
              newAdminAnswers[updatedAppeal.questionNumber] = 'X';
              needsRecalculation = true;
          } else if (updatedAppeal.adminDecision === 'CHANGE_ANSWER' && updatedAppeal.newAnswer) {
              newAdminAnswers[updatedAppeal.questionNumber] = updatedAppeal.newAnswer;
              needsRecalculation = true;
          }
      }

      const updatedAppeals = appState!.appeals.map(a => a.id === updatedAppeal.id ? updatedAppeal : a);

      if (needsRecalculation) {
          const recalculated = recalculateAllSubmissions(appState!.submissions, newAdminAnswers);
          updateAndPersistState(prev => ({
              ...prev,
              appeals: updatedAppeals,
              adminAnswers: newAdminAnswers,
              submissions: recalculated,
          }));
          alert('Gabarito atualizado e todas as pontuações foram recalculadas!');
      } else {
          updateAndPersistState(prev => ({ ...prev, appeals: updatedAppeals }));
          alert('Status do recurso atualizado!');
      }

  }, [appState, updateAndPersistState, recalculateAllSubmissions]);
  
  const handleResetAllData = useCallback(() => {
    updateAndPersistState(() => ({
      submissions: [],
      appeals: [],
      adminAnswers: DEFAULT_ADMIN_ANSWERS,
      appealDeadline: '',
      formTitle: 'Formulário de Avaliação',
    }));
    alert('Todos os dados foram restaurados para o estado inicial.');
  }, [updateAndPersistState]);

  const handleSetDeadline = useCallback((deadline: string) => {
    updateAndPersistState(prev => ({ ...prev, appealDeadline: deadline }));
  }, [updateAndPersistState]);

  const handleSetFormTitle = useCallback((title: string) => {
    updateAndPersistState(prev => ({ ...prev, formTitle: title }));
  }, [updateAndPersistState]);


  if (!appState) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="text-xl font-semibold text-primary animate-pulse">Carregando Sistema...</div>
      </div>
    );
  }

  const renderContent = () => {
    if (isAdminView) {
        if (isAdminAuthenticated) {
            return <AdminView 
                initialAnswers={appState.adminAnswers} 
                onSave={handleAdminAnswersSave}
                appeals={appState.appeals}
                onProcessAppeal={handleProcessAppeal}
                deadline={appState.appealDeadline}
                onSetDeadline={handleSetDeadline}
                onResetAllData={handleResetAllData}
                formTitle={appState.formTitle}
                onSetFormTitle={handleSetFormTitle}
                submissions={appState.submissions}
            />;
        }
        return <AdminLogin onLogin={handleAdminLogin} error={error} />;
    }

    if (view === 'answersheet') {
        return (
            <AnswerSheet
                answers={userAnswers}
                setAnswers={setUserAnswers}
                onSubmit={handleAnswersSubmit}
                userNickname={currentUser?.nickname || 'Usuário'}
            />
        );
    }
    
    if (!currentUser || !lastSubmissionResult) {
        return <IdentificationForm onSubmit={handleIdentificationSubmit} onLogin={handleUserLogin} submissions={appState.submissions} error={error} />;
    }
    
    // Logged-in user view
    return (
        <>
            <UserNavigation currentView={view} onViewChange={setView} onLogout={handleStartOver} />
            {view === 'results' && (
                <ResultsDisplay
                    score={lastSubmissionResult.score}
                    totalPoints={MAX_POSSIBLE_SCORE}
                    rank={lastSubmissionResult.rank}
                    userAnswers={lastSubmissionResult.answers}
                    adminAnswers={appState.adminAnswers}
                    status={lastSubmissionResult.status}
                    reprovalReasons={lastSubmissionResult.reprovalReasons}
                />
            )}
            {view === 'ranking' && <Ranking submissions={appState.submissions} currentUserCpf={currentUser.cpf} />}
            {view === 'appeals' && (
                <UserAppeals
                    currentUser={currentUser}
                    allAppeals={appState.appeals}
                    onSubmitAppeal={handleAppealSubmit}
                    appealDeadline={appState.appealDeadline}
                />
            )}
        </>
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-100 text-textPrimary flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
        <header className="w-full max-w-5xl mb-8 text-center relative">
            <h1 className="text-4xl sm:text-5xl font-bold text-primary">{appState.formTitle}</h1>
            <p className="text-lg text-textSecondary mt-2">
              {isAdminView ? 'Painel do Administrador' : 'Preencha seus dados, responda as questões e veja sua pontuação no ranking!'}
            </p>
            <div className="absolute top-0 right-0">
              <button
                onClick={handleToggleAdminView}
                className="bg-white border border-secondary text-secondary font-semibold py-2 px-4 rounded-lg hover:bg-secondary hover:text-white transition-colors duration-300 shadow-sm"
              >
                {isAdminView ? 'Sair do Admin' : 'Admin'}
              </button>
            </div>
        </header>
        <main className="w-full max-w-5xl bg-white rounded-2xl shadow-xl p-6 sm:p-10 transition-all duration-500">
            {renderContent()}
        </main>
    </div>
  );
};

export default App;
