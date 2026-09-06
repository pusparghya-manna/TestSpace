import React from 'react';
import { Home, BookOpen, BarChart3, Trophy, User } from 'lucide-react';

interface NavigationProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  hasOngoing: boolean;
}

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'exams', label: 'Exams', icon: BookOpen },
  { id: 'results', label: 'Results', icon: BarChart3 },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'profile', label: 'Profile', icon: User }
];

export const DesktopNavigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  hasOngoing
}) => {
  return (
    <div className="hidden md:flex items-center gap-1.5 glass-panel p-1 rounded-2xl">
      {NAV_ITEMS.map(item => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        const isExamTab = item.id === 'exams';

        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition relative ${
              isActive
                ? 'glass-card text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
            {isExamTab && hasOngoing && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-white" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export const MobileNavigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  hasOngoing
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-dock px-2 py-1 safe-bottom">
      <div className="grid grid-cols-5 gap-1 max-w-md mx-auto">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isExamTab = item.id === 'exams';

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg transition relative ${
                isActive
                  ? 'text-blue-600 glass-pill font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {isExamTab && hasOngoing && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </div>
              <span className="text-[9px] mt-0.5 tracking-tight truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export const Navigation: React.FC<NavigationProps> = props => {
  return (
    <>
      <MobileNavigation {...props} />
      <DesktopNavigation {...props} />
    </>
  );
};
