import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Check, 
  Trash2, 
  Play, 
  Pause, 
  Briefcase,
  Users,
  X,
  Settings,
  Maximize,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  AlertTriangle,
  UserPlus,
  FileText,
  Download,
  Calendar,
  Moon,
  Sun,
  Cloud,
  LogOut,
  CalendarCheck,
  MoreHorizontal,
  Upload,
  BrainCircuit,
  MessageSquarePlus,
  List,
  Share2,
  Zap, 
  Clock
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  signInWithCustomToken
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot
} from "firebase/firestore";

/**
 * NeuroFlow Week Planner - V7.1 (Stable Polish)
 * * CORE FEATURES:
 * 1. FreeMind Layout Engine (Left/Right weighted trees)
 * 2. Firestore Cloud Sync & Google Calendar Integration
 * 3. ADHD-Friendly UI (Warm Dark Mode, Task Aging, Focus Mode)
 * 4. Context-Aware Modal Workflow (Task -> Client -> Task)
 * 5. Robust Drag & Drop and Z-Index Stacking
 */

// --- 0. Firebase Setup ---
let app, auth, db, provider;
let appId = 'neuroflow-prod'; 

try {
    const configRaw = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_FIREBASE_CONFIG : undefined;

    if (configRaw) {
        const firebaseConfig = JSON.parse(configRaw);
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar.events');
         } else {
        if (typeof __firebase_config !== 'undefined') {
             const firebaseConfig = JSON.parse(__firebase_config);
             app = initializeApp(firebaseConfig);
             auth = getAuth(app);
             db = getFirestore(app);
             provider = new GoogleAuthProvider();
             provider.addScope('https://www.googleapis.com/auth/calendar.events');
             if (typeof __app_id !== 'undefined') appId = __app_id;
        } else {
             console.warn("VITE_FIREBASE_CONFIG is missing. Auth will fail.");
        }
    }
} catch (e) {
    console.error("Firebase init failed:", e);
}

// --- 1. Theme & Color System ---

const THEME_COLORS = {
    stone: { 
        light: 'bg-stone-200 border-stone-300 text-stone-800', 
        dark: 'bg-stone-800 border-stone-600 text-stone-200',
        preview: 'bg-stone-200'
    },
    teal: { 
        light: 'bg-teal-100 border-teal-300 text-teal-900', 
        dark: 'bg-teal-900/40 border-teal-700 text-teal-100',
        preview: 'bg-teal-400'
    },
    indigo: { 
        light: 'bg-indigo-100 border-indigo-300 text-indigo-900', 
        dark: 'bg-indigo-900/40 border-indigo-700 text-indigo-100',
        preview: 'bg-indigo-400'
    },
    rose: { 
        light: 'bg-rose-100 border-rose-300 text-rose-900', 
        dark: 'bg-rose-900/40 border-rose-700 text-rose-100',
        preview: 'bg-rose-400'
    },
    amber: { 
        light: 'bg-amber-100 border-amber-300 text-amber-900', 
        dark: 'bg-amber-900/40 border-amber-700 text-amber-100',
        preview: 'bg-amber-400'
    },
    emerald: { 
        light: 'bg-emerald-100 border-emerald-300 text-emerald-900', 
        dark: 'bg-emerald-900/40 border-emerald-700 text-emerald-100',
        preview: 'bg-emerald-400'
    },
    cyan: { 
        light: 'bg-cyan-100 border-cyan-300 text-cyan-900', 
        dark: 'bg-cyan-900/40 border-cyan-700 text-cyan-100',
        preview: 'bg-cyan-400'
    },
    violet: { 
        light: 'bg-violet-100 border-violet-300 text-violet-900', 
        dark: 'bg-violet-900/40 border-violet-700 text-violet-100',
        preview: 'bg-violet-400'
    }
};

const getThemeClasses = (colorKey, isDarkMode) => {
    const key = THEME_COLORS[colorKey] ? colorKey : 'stone';
    return isDarkMode ? THEME_COLORS[key].dark : THEME_COLORS[key].light;
};

// --- 2. Utility Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
};

const sanitizeTasks = (tasks) => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter(t => t && typeof t === 'object').map(t => ({
        ...t,
        children: sanitizeTasks(t.children || [])
    }));
};

const migrateClients = (clients) => {
    if (!Array.isArray(clients)) return [];
    return clients.map(c => {
        if (THEME_COLORS[c.color]) return c;
        if (c.color && c.color.includes('bg-')) {
            const map = ['teal','indigo','rose','amber','emerald','cyan','violet'];
            const found = map.find(k => c.color.includes(k));
            return { ...c, color: found || 'stone' };
        }
        return { ...c, color: 'stone' };
    });
};

const getTaskAge = (createdAt) => {
    if (!createdAt) return 0;
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
};

// --- 3. Initial Data ---

const INITIAL_CLIENTS = [];

const INITIAL_DATA = {
  weekOffset: 0, 
  tasks: []
};

// --- 4. CSS ---
const TreeStyles = ({ isDarkMode }) => {
  const lineColor = isDarkMode ? '#57534e' : '#d6d3d1';
  return (
  <style>{`
    .mm-children-right { display: flex; flex-direction: column; padding-left: 48px; position: relative; justify-content: center; }
    .mm-child-right { position: relative; display: flex; align-items: center; padding: 12px 0; }
    .mm-child-right::before { content: ''; position: absolute; left: -48px; top: 50%; width: 48px; height: 3px; background: ${lineColor}; }
    .mm-child-right::after { content: ''; position: absolute; left: -48px; width: 3px; background: ${lineColor}; }
    .mm-child-right:first-child::after { top: 50%; bottom: 0; }
    .mm-child-right:last-child::after { top: 0; bottom: 50%; }
    .mm-child-right:not(:first-child):not(:last-child)::after { top: 0; bottom: 0; }
    .mm-child-right:only-child::after { display: none; }

    .mm-children-left { display: flex; flex-direction: column; padding-right: 48px; position: relative; justify-content: center; align-items: flex-end; }
    .mm-child-left { position: relative; display: flex; flex-direction: row-reverse; align-items: center; padding: 12px 0; }
    .mm-child-left::before { content: ''; position: absolute; right: -48px; top: 50%; width: 48px; height: 3px; background: ${lineColor}; }
    .mm-child-left::after { content: ''; position: absolute; right: -48px; width: 3px; background: ${lineColor}; }
    .mm-child-left:first-child::after { top: 50%; bottom: 0; }
    .mm-child-left:last-child::after { top: 0; bottom: 50%; }
    .mm-child-left:not(:first-child):not(:last-child)::after { top: 0; bottom: 0; }
    .mm-child-left:only-child::after { display: none; }
  `}</style>
  );
};

// --- 5. Components ---

const TitleBar = ({ user, isDarkMode, loginWithGoogle, logout }) => {
    return (
        <div 
            className={`fixed top-0 left-0 right-0 h-14 border-b flex items-center justify-between px-4 z-[90] ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}
            onMouseDown={(e) => e.stopPropagation()} 
            onTouchStart={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                    <BrainCircuit size={20} />
                </div>
                <h1 className={`font-bold text-lg tracking-tight ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>NeuroFlow</h1>
            </div>

            <div className="flex items-center gap-4">
                {user ? (
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end hidden sm:flex">
                            <span className={`text-xs font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>{user.displayName}</span>
                            <span className={`text-[10px] ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>{user.email}</span>
                        </div>
                        <div className="relative group">
                            <img 
                                src={user.photoURL} 
                                alt="User" 
                                className="w-8 h-8 rounded-full border-2 border-transparent group-hover:border-indigo-500 transition-colors cursor-pointer"
                            />
                            <div className="absolute right-0 top-10 w-32 bg-white rounded-lg shadow-xl border overflow-hidden hidden group-hover:block">
                                <button onClick={logout} className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                                    <LogOut size={12} /> Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={loginWithGoogle}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDarkMode ? 'bg-stone-800 text-stone-300 hover:bg-stone-700' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                    >
                        <Cloud size={16} /> <span className="hidden sm:inline">Connect Google</span>
                    </button>
                )}
            </div>
        </div>
    )
}

const Timer = ({ isRunning, timeSpent, onToggle, isDarkMode }) => (
    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-all border ${isRunning ? 'bg-rose-500 text-white border-rose-600 shadow-inner' : isDarkMode ? 'bg-stone-800 text-stone-400 border-stone-700 hover:border-teal-700 hover:text-teal-400' : 'bg-stone-100 text-stone-500 border-stone-200 hover:border-teal-400 hover:text-teal-700'}`}>
      <span>{formatTime(timeSpent)}</span>
      {isRunning ? <Pause size={10} className="fill-current" /> : <Play size={10} className="fill-current" />}
    </button>
);

const ListViewTask = ({ node, depth, onUpdate, onAddChild, onDelete, onTimerToggle, activeTimers, isDarkMode, onInspect, focusId }) => {
    if (!node) return null;
    const isRunning = activeTimers.includes(node.id);
    const indent = depth * 24; 
    
    // Focus Logic
    const isFocused = focusId && focusId === node.id;
    const isDimmed = focusId && !isFocused;
    
    // Styles
    const rowClass = isDarkMode ? 'border-b border-stone-800 hover:bg-stone-800/50' : 'border-b border-stone-100 hover:bg-stone-50';
    const textClass = node.completed ? (isDarkMode ? 'line-through text-stone-600' : 'line-through text-stone-400') : (isDarkMode ? 'text-stone-200' : 'text-stone-800');
    
    // Aging Logic
    const daysOld = getTaskAge(node.createdAt);
    const isStale = !node.completed && daysOld > 3;

    return (
        <>
            <div 
                className={`flex items-center py-3 pr-4 group transition-opacity duration-300 ${rowClass} ${isDimmed ? 'opacity-20 blur-[1px]' : 'opacity-100'} ${isFocused ? 'bg-amber-50/10' : ''}`} 
                style={{ paddingLeft: `${indent}px` }}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                     {node.children && node.children.length > 0 && (
                        <button onClick={() => onUpdate(node.id, { expanded: !node.expanded })} className={`p-1 rounded hover:bg-stone-200/20 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>
                            {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    )}
                    {!node.children?.length && <div className="w-6" />}
                    <button onClick={() => onUpdate(node.id, { completed: !node.completed })} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${node.completed ? 'bg-teal-600 border-teal-600 text-white' : 'border-stone-400 bg-transparent'}`}>
                        {node.completed && <Check size={10} />}
                    </button>
                    
                    <input type="text" value={node.text} onChange={(e) => onUpdate(node.id, { text: e.target.value })} className={`bg-transparent outline-none flex-1 text-sm font-medium ${textClass}`} placeholder="Task..." />
                    
                    {/* Age Indicator */}
                    {isStale && (
                        <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${daysOld > 7 ? 'bg-amber-500/20 text-amber-600' : 'bg-stone-500/20 text-stone-500'}`}>
                            <Clock size={10} /> <span>{daysOld}d</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Timer isRunning={isRunning} timeSpent={node.timeSpent} onToggle={() => onTimerToggle(node.id)} isDarkMode={isDarkMode} />
                    <button onClick={() => onInspect(node)} className="p-1.5 text-stone-400 hover:text-indigo-500 rounded"><Calendar size={14}/></button>
                    <button onClick={() => onAddChild(node.id)} className="p-1.5 text-stone-400 hover:text-teal-500 rounded"><Plus size={14}/></button>
                    <button onClick={() => onDelete(node.id)} className="p-1.5 text-stone-400 hover:text-rose-500 rounded"><Trash2 size={14}/></button>
                </div>
            </div>
            {node.expanded && node.children && node.children.map(child => (
                <ListViewTask key={child.id} node={child} depth={depth + 1} onUpdate={onUpdate} onAddChild={onAddChild} onDelete={onDelete} onTimerToggle={onTimerToggle} activeTimers={activeTimers} isDarkMode={isDarkMode} onInspect={onInspect} focusId={focusId} />
            ))}
        </>
    );
};

const ListViewClient = ({ node, clients, onUpdate, onAddChild, onDelete, onTimerToggle, activeTimers, openClientManager, isDarkMode, onInspect, focusId }) => {
    if (!node) return null;
    const client = clients.find(c => c.id === node.clientId) || { color: 'stone', name: 'Unknown' };
    const themeClass = getThemeClasses(client.color, isDarkMode);
    const optionClass = isDarkMode ? "bg-stone-800 text-stone-200" : "bg-white text-stone-800";
    
    const isDimmed = focusId && !node.children.some(child => JSON.stringify(child).includes(focusId));

    return (
        <div className={`mb-4 transition-opacity duration-300 ${isDimmed ? 'opacity-20 grayscale' : 'opacity-100'}`}>
            <div className={`flex items-center justify-between p-3 rounded-lg border-l-4 mb-1 ${themeClass}`}>
                <div className="flex items-center gap-3">
                    {client.logo ? <img src={client.logo} alt="Logo" className="w-6 h-6 rounded object-cover" /> : <Briefcase size={18} className="opacity-80" />}
                    
                    <select 
                        value={node.clientId} 
                        onChange={(e) => { if(e.target.value === 'ADD_NEW') openClientManager(); else onUpdate(node.id, { clientId: e.target.value }); }}
                        className={`bg-transparent text-sm font-bold outline-none cursor-pointer`}
                    >
                        {clients.map(c => <option key={c.id} value={c.id} className={optionClass}>{c.name}</option>)}
                        <option value="ADD_NEW" className={optionClass}>+ Add New...</option>
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={() => onAddChild(node.id)} className="p-1.5 opacity-60 hover:opacity-100 transition-opacity"><Plus size={16}/></button>
                    <button onClick={() => onDelete(node.id)} className="p-1.5 opacity-60 hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                    <button onClick={() => onUpdate(node.id, { expanded: !node.expanded })} className="p-1.5 opacity-60 hover:opacity-100 transition-opacity">
                         {node.expanded ? <ChevronDown size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>
            </div>

            {node.expanded && (
                <div className="border-l-2 ml-4 pl-0" style={{ borderColor: isDarkMode ? '#292524' : '#f5f5f4' }}>
                     {node.children && node.children.map(child => (
                         <ListViewTask 
                             key={child.id} 
                             node={child} 
                             depth={1} 
                             onUpdate={onUpdate} 
                             onAddChild={onAddChild} 
                             onDelete={onDelete} 
                             onTimerToggle={onTimerToggle} 
                             activeTimers={activeTimers} 
                             isDarkMode={isDarkMode}
                             onInspect={onInspect}
                             focusId={focusId}
                         />
                     ))}
                     {(!node.children || node.children.length === 0) && <div className={`p-3 text-xs italic ${isDarkMode ? 'text-stone-600' : 'text-stone-400'}`}>No tasks yet.</div>}
                </div>
            )}
        </div>
    )
}

const TaskNode = ({ node, onUpdate, onAddChild, onDelete, onTimerToggle, activeTimers, direction, isDarkMode, onInspect, focusId }) => {
    if (!node) return null;
    const isRunning = activeTimers.includes(node.id);
    const daysOld = getTaskAge(node.createdAt);
    const isStale = !node.completed && daysOld > 7;
    const isMidStale = !node.completed && daysOld > 3;

    const isFocused = focusId && focusId === node.id;
    const isDimmed = focusId && !isFocused;

    const staleBorder = isStale ? 'border-amber-400 shadow-amber-500/20' : '';
    const baseCard = isDarkMode ? 'bg-stone-800 border-stone-700 shadow-stone-900/20' : 'bg-stone-50 border-stone-300 shadow-sm';
    const focusRing = isFocused ? 'ring-4 ring-indigo-500 border-transparent shadow-2xl scale-110 z-50' : 'focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent';
    const inputColor = isDarkMode ? 'text-stone-200 placeholder-stone-600' : 'text-stone-800 placeholder-stone-400';
    const completedText = isDarkMode ? 'line-through text-stone-600' : 'line-through text-stone-400';
    
    const wrapperStyle = {
        transition: 'all 0.5s ease',
        opacity: isDimmed ? 0.1 : 1,
        filter: isDimmed ? 'grayscale(100%) blur(1px)' : 'none',
        pointerEvents: isDimmed ? 'none' : 'auto'
    };

    return (
        <div className={`mm-child-${direction}`} style={wrapperStyle}>
            <div 
                className={`flex flex-col gap-1 p-3 rounded-xl border shadow-sm relative z-20 shrink-0 w-56 transition-all ${focusRing} ${staleBorder} ${node.completed ? 'opacity-60 grayscale' : ''} ${baseCard}`}
                onMouseDown={(e) => e.stopPropagation()} 
                onTouchStart={(e) => e.stopPropagation()} 
            >
                <div className="flex w-full items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { completed: !node.completed }); }} className={`w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center transition-colors ${node.completed ? 'bg-teal-600 border-teal-600 text-white' : 'border-stone-400 bg-transparent hover:border-teal-500'}`}>
                        {node.completed && <Check size={12} strokeWidth={4} />}
                    </button>
                    <input type="text" value={node.text} onChange={(e) => onUpdate(node.id, { text: e.target.value })} className={`bg-transparent outline-none flex-1 text-sm font-semibold ${node.completed ? completedText : inputColor}`} placeholder="Task..." />
                </div>
                
                {isMidStale && !node.completed && (
                    <div className="flex items-center gap-1 mt-1">
                         <div className={`text-[10px] px-1.5 rounded-full flex items-center gap-1 ${isStale ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-500'}`}>
                            <Clock size={10} /> <span>{daysOld} days old</span>
                         </div>
                    </div>
                )}

                <div className={`flex items-center justify-between w-full pt-2 border-t mt-1 ${isDarkMode ? 'border-stone-700' : 'border-stone-200/60'}`}>
                    <Timer isRunning={isRunning} timeSpent={node.timeSpent} onToggle={() => onTimerToggle(node.id)} isDarkMode={isDarkMode} />
                    <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); onInspect(node); }} className="p-1 text-stone-400 hover:bg-stone-200/10 rounded-md hover:text-indigo-500" title="Details & Calendar"><Calendar size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} className="p-1 text-teal-600 hover:bg-teal-500/10 rounded-md"><Plus size={16}/></button>
                        {node.children && node.children.length > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { expanded: !node.expanded }); }} className="p-1 text-stone-500 hover:bg-stone-200/10 rounded-md">
                                {node.expanded ? <ChevronDown size={16}/> : (direction === 'left' ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>)}
                            </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="p-1 text-stone-400 hover:bg-rose-500/10 rounded-md hover:text-rose-500"><Trash2 size={16}/></button>
                    </div>
                </div>
            </div>
            {node.expanded && node.children && node.children.length > 0 && (
                <div className={`mm-children-${direction}`}>
                    {node.children.map(child => (
                        <TaskNode key={child.id} node={child} onUpdate={onUpdate} onAddChild={onAddChild} onDelete={onDelete} onTimerToggle={onTimerToggle} activeTimers={activeTimers} direction={direction} isDarkMode={isDarkMode} onInspect={onInspect} focusId={focusId} />
                    ))}
                </div>
            )}
        </div>
    );
};

const ClientNode = ({ node, direction, clients, onUpdate, onAddChild, onDelete, onTimerToggle, activeTimers, openClientManager, isDarkMode, onInspect, focusId }) => {
    if (!node) return null;
    const client = (clients && clients.length > 0) ? (clients.find(c => c.id === node.clientId) || clients[0]) : { color: 'stone' };
    const themeClass = getThemeClasses(client.color, isDarkMode);
    const optionClass = isDarkMode ? "bg-stone-800 text-stone-200" : "bg-white text-stone-800";
    
    const containsFocus = focusId ? (JSON.stringify(node).includes(focusId)) : true;
    const isDimmed = focusId && !containsFocus;
    
    const wrapperStyle = {
        transition: 'all 0.5s ease',
        opacity: isDimmed ? 0.1 : 1,
        filter: isDimmed ? 'grayscale(100%) blur(1px)' : 'none',
        pointerEvents: isDimmed ? 'none' : 'auto'
    };

    const handleClientChange = (e) => {
        if (e.target.value === 'ADD_NEW') openClientManager();
        else onUpdate(node.id, { clientId: e.target.value });
    };

    return (
        <div className={`mm-child-${direction}`} style={wrapperStyle}>
            <div 
                className={`relative z-20 px-4 py-2.5 rounded-full shadow-md border-2 flex items-center gap-2 transition-all hover:scale-[1.02] shrink-0 min-w-[170px] ${themeClass}`}
                onMouseDown={(e) => e.stopPropagation()} 
                onTouchStart={(e) => e.stopPropagation()} 
            >
                {client.logo ? <img src={client.logo} alt="Logo" className="w-5 h-5 rounded object-cover border border-current/20 flex-shrink-0" /> : <Briefcase size={18} className="opacity-80 flex-shrink-0" />}
                <select value={node.clientId} onChange={handleClientChange} className="bg-transparent font-bold text-sm outline-none cursor-pointer appearance-none truncate flex-1 text-center">
                    {clients && clients.map(c => <option key={c.id} value={c.id} className={optionClass}>{c.name}</option>)}
                    <option disabled className={optionClass}>──────────</option>
                    <option value="ADD_NEW" className={optionClass}>+ Add New...</option>
                </select>
                <div className="flex gap-1 border-l pl-2 border-current/20">
                    <button onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} className="opacity-60 hover:opacity-100"><Plus size={16}/></button>
                    {node.children && node.children.length > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { expanded: !node.expanded }); }} className="opacity-60 hover:opacity-100">
                            {node.expanded ? <ChevronDown size={16}/> : (direction === 'left' ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>)}
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="opacity-60 hover:opacity-100"><Trash2 size={16}/></button>
                </div>
            </div>
            {node.expanded && node.children && node.children.length > 0 && (
                <div className={`mm-children-${direction}`}>
                    {node.children.map(child => (
                        <TaskNode key={child.id} node={child} onUpdate={onUpdate} onAddChild={onAddChild} onDelete={onDelete} onTimerToggle={onTimerToggle} activeTimers={activeTimers} direction={direction} isDarkMode={isDarkMode} onInspect={onInspect} focusId={focusId} />
                    ))}
                </div>
            )}
        </div>
    );
};

const AddTaskModal = ({ isOpen, onClose, clients, tasks, onAdd, isDarkMode, onSwitchToClientManager, initialTitle }) => {
    const [title, setTitle] = useState(initialTitle || '');
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedParent, setSelectedParent] = useState('ROOT');

    useEffect(() => {
        if (isOpen && clients.length > 0) {
            // Only auto-select if we have clients
            if (!selectedClient) setSelectedClient(clients[0].id);
            if (!selectedParent) setSelectedParent('ROOT');
            // Only reset if no initial title was passed (fresh open)
            if (initialTitle === undefined) setTitle('');
        } else if (isOpen && clients.length === 0) {
            setSelectedClient(''); 
        }
    }, [isOpen, clients, initialTitle]);
    
    // If initialTitle changes (return from client manager), update local state
    useEffect(() => {
        if (initialTitle) setTitle(initialTitle);
    }, [initialTitle]);

    if (!isOpen) return null;

    const getFlattenedOptions = (nodes, clientId, depth = 0) => {
        let options = [];
        nodes.forEach(node => {
            const isRoot = node.type === 'client';
            if (isRoot && node.clientId !== clientId) return;

            if (isRoot) {
                options.push({ id: node.id, label: `Root: ${clients.find(c=>c.id===node.clientId)?.name || 'Unknown'}`, depth: 0 });
                if (node.children) options = [...options, ...getFlattenedOptions(node.children, clientId, 1)];
            } else {
                options.push({ id: node.id, label: node.text || 'Untitled Task', depth });
                if (node.children) options = [...options, ...getFlattenedOptions(node.children, clientId, depth + 1)];
            }
        });
        return options;
    };
    
    const activeRoots = tasks.filter(t => t.type === 'client' && t.clientId === selectedClient);
    const parentOptions = getFlattenedOptions(activeRoots, selectedClient);

    const handleSubmit = () => {
        if (!title.trim()) return;
        
        let targetParentId = selectedParent;
        
        // Determine if we are adding to an existing Root
        if (selectedParent === 'ROOT') {
            const existingRoot = tasks.find(t => t.type === 'client' && t.clientId === selectedClient);
            if (existingRoot) {
                targetParentId = existingRoot.id;
            } else {
                targetParentId = null; // Needs new client node
            }
        }

        onAdd(targetParentId, { text: title, clientId: selectedClient });
        onClose();
    };

    const inputClass = `w-full border rounded-lg px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-white border-stone-200'}`;
    const labelClass = `text-xs font-bold uppercase block mb-1.5 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`;
    const optionClass = isDarkMode ? "bg-stone-800 text-stone-200" : "bg-white text-stone-800";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <div className={`w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white'}`}>
                <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}><h3 className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}><MessageSquarePlus size={20} className="text-teal-500"/> New Task</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className={labelClass}>Project / Client</label>
                        <select 
                            value={selectedClient} 
                            onChange={e => {
                                if (e.target.value === 'ADD_NEW') onSwitchToClientManager(title);
                                else setSelectedClient(e.target.value);
                            }} 
                            className={inputClass}
                        >
                             {/* FIX: Default disabled option forces a change event when selecting "Add New" */}
                            <option value="" disabled className={optionClass}>Select Project...</option>
                            {clients.map(c => <option key={c.id} value={c.id} className={optionClass}>{c.name}</option>)}
                            <option value="ADD_NEW" className={optionClass}>+ Add New...</option>
                        </select>
                    </div>
                    <div><label className={labelClass}>Parent Task</label><select value={selectedParent} onChange={e => setSelectedParent(e.target.value)} className={inputClass} disabled={parentOptions.length === 0 || !selectedClient}>{parentOptions.length === 0 ? <option value="ROOT" className={optionClass}>New Root Branch</option> : parentOptions.map(opt => <option key={opt.id} value={opt.id} className={optionClass}>{'\u00A0'.repeat(opt.depth * 3)} {opt.depth > 0 ? '└ ' : ''} {opt.label}</option>)}</select></div>
                    <div><label className={labelClass}>Task Title</label><input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" className={inputClass} onKeyDown={e => e.key === 'Enter' && handleSubmit()} /></div>
                    <button onClick={handleSubmit} disabled={!title.trim() || !selectedClient} className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-lg shadow-teal-900/20 transition-all disabled:opacity-50">Create Task</button>
                </div>
            </div>
        </div>
    );
};

const InspectorPanel = ({ node, onUpdate, onDelete, isDarkMode, clients, onExportCalendar, onClose }) => {
    if (!node) return null;
    const client = clients.find(c => c.id === node.clientId);
    const isClient = node.type === 'client';
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
            <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-stone-900 border border-stone-800' : 'bg-white'}`}>
                <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}><h3 className={`font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{isClient ? 'Client Details' : 'Task Details'}</h3><button onClick={onClose}><X size={18}/></button></div>
                <div className="p-6 space-y-6">
                    <div><label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Label</label><input type="text" value={node.text} onChange={(e) => onUpdate(node.id, { text: e.target.value })} className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-white border-stone-200'}`} /></div>
                    {!isClient && <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-200'}`}><div className="flex justify-between items-center mb-2"><span className={`text-xs font-bold uppercase ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Total Duration</span><span className={`font-mono font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{formatTime(node.timeSpent)}</span></div><button onClick={() => onExportCalendar(node)} className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"><CalendarCheck size={14} /> Push to Calendar</button><p className="text-[10px] text-center mt-2 text-stone-500">Creates a 1hr event (or duration) on GCal</p></div>}
                    <div className="pt-4 border-t border-stone-200/10"><button onClick={() => onDelete(node.id)} className="w-full py-2 flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-sm font-medium"><Trash2 size={16}/> Delete Branch</button></div>
                </div>
            </div>
        </div>
    );
};

const ReportModal = ({ isOpen, onClose, data, clients, isDarkMode }) => {
    // ... [Report Modal logic preserved] ...
    const formatLocalDate = (date) => { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; };
    const getFirstDay = () => { const d = new Date(); return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1)); };
    const getLastDay = () => { const d = new Date(); return formatLocalDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
    const [startDate, setStartDate] = useState(getFirstDay());
    const [endDate, setEndDate] = useState(getLastDay());
    const [selectedClient, setSelectedClient] = useState('ALL');
    if (!isOpen) return null;
    let reportData = [];
    const traverse = (node, currentClientId) => {
        const effectiveClientId = node.type === 'client' ? node.clientId : currentClientId;
        if (selectedClient === 'ALL' || effectiveClientId === selectedClient) {
            const clientObj = clients.find(c => c.id === effectiveClientId) || { name: 'Unknown' };
            if (node.sessions && node.sessions.length > 0) {
                node.sessions.forEach(session => {
                    if (!session.start) return;
                    const sStart = new Date(session.start);
                    const sEnd = session.end ? new Date(session.end) : new Date();
                    const filterStart = new Date(startDate); filterStart.setHours(0, 0, 0, 0);
                    const filterEnd = new Date(endDate); filterEnd.setHours(23, 59, 59, 999);
                    if (sStart <= filterEnd && sEnd >= filterStart) {
                        const overlapStart = new Date(Math.max(sStart.getTime(), filterStart.getTime()));
                        const overlapEnd = new Date(Math.min(sEnd.getTime(), filterEnd.getTime()));
                        const validTime = (overlapEnd - overlapStart) / 1000; 
                        if (validTime > 0) reportData.push({ taskName: node.text || 'Unnamed Task', clientName: clientObj.name, start: overlapStart, end: overlapEnd, duration: validTime });
                    }
                });
            }
        }
        if (node.children) node.children.forEach(child => traverse(child, effectiveClientId));
    };
    if (data && data.tasks) data.tasks.forEach(rootNode => traverse(rootNode, rootNode.clientId));
    const aggregated = reportData.reduce((acc, row) => { if (!acc[row.clientName]) acc[row.clientName] = 0; acc[row.clientName] += row.duration; return acc; }, {});
    const handleExport = () => {
        let csvContent = "data:text/csv;charset=utf-8,Client,Task,Start Time,End Time,Duration (HH:MM:SS),Duration (Seconds)\n";
        const formatDateTime = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); const h = String(d.getHours()).padStart(2, '0'); const min = String(d.getMinutes()).padStart(2, '0'); const s = String(d.getSeconds()).padStart(2, '0'); return `${y}-${m}-${day} ${h}:${min}:${s}`; };
        reportData.forEach(row => {
            const hours = Math.floor(row.duration / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((row.duration % 3600) / 60).toString().padStart(2, '0');
            const seconds = Math.floor(row.duration % 60).toString().padStart(2, '0');
            const durationStr = `${hours}:${minutes}:${seconds}`;
            const safeTaskName = row.taskName.replace(/"/g, '""');
            csvContent += `"${row.clientName}","${safeTaskName}","${formatDateTime(row.start)}","${formatDateTime(row.end)}","${durationStr}",${Math.round(row.duration)}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `NeuroFlow_Report_${startDate}_to_${endDate}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };
    const inputClass = `w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-white border-stone-200'}`;
    const optionClass = isDarkMode ? "bg-stone-800 text-stone-200" : "bg-white text-stone-800";
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 text-left" onWheel={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ${isDarkMode ? 'bg-stone-900 border border-stone-800' : 'bg-white'}`}>
                <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-100'}`}><h3 className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}><Calendar size={18} /> Export Report</h3><button onClick={onClose}><X size={18} className={isDarkMode ? 'text-stone-400' : 'text-stone-400'}/></button></div>
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex gap-4"><div className="flex-1"><label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>From</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} /></div><div className="flex-1"><label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>To</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} /></div></div>
                        <div><label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Filter</label><select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className={inputClass}><option value="ALL" className={optionClass}>All Clients & Projects</option>{clients.map(c => <option key={c.id} value={c.id} className={optionClass}>{c.name}</option>)}</select></div>
                        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-200'}`}><h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>Summary</h4>{Object.keys(aggregated).length === 0 ? <p className="text-xs text-stone-500 italic">No time tracked in this period.</p> : <ul className="space-y-1.5">{Object.entries(aggregated).map(([clientName, duration]) => <li key={clientName} className="flex justify-between text-sm"><span className={`${isDarkMode ? 'text-stone-400' : 'text-stone-600'} font-medium`}>{clientName}</span><span className={`font-mono font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{formatTime(duration)}</span></li>)}</ul>}</div>
                        <button onClick={handleExport} disabled={reportData.length === 0} className="w-full bg-teal-600 text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"><Download size={18} /> Download CSV Report</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ClientManagerModal = ({ isOpen, onClose, clients, setClients, isDarkMode }) => {
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('stone');
    const [newLogo, setNewLogo] = useState(null); 
    if (!isOpen) return null;
    const handleLogoUpload = (e) => { const file = e.target.files[0]; if (file) { if (file.size > 100 * 1024) { alert("Logo must be under 100KB"); return; } const reader = new FileReader(); reader.onloadend = () => { setNewLogo(reader.result); }; reader.readAsDataURL(file); } };
    const handleAdd = () => { if (!newName.trim()) return; setClients([...clients, { id: generateId(), name: newName, color: newColor, logo: newLogo }]); setNewName(''); setNewLogo(null); };
    const handleDelete = (id) => { if (clients.length <= 1) { alert("You need at least one client."); return; } setClients(clients.filter(c => c.id !== id)); };
    const colorOptions = Object.keys(THEME_COLORS).map(key => ({ key, previewClass: THEME_COLORS[key].preview }));
    return (
        // Z-Index boosted to 200 to override Add Task modal if opened
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onWheel={e => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white'}`}>
                <div className="p-4 border-b border-stone-200/10 flex justify-between items-center"><h3 className={`font-bold flex gap-2 ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}><Users size={18}/> Clients</h3><button onClick={onClose}><X size={18} className="text-stone-400"/></button></div>
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div><label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Name & Logo</label><div className="flex gap-2 items-center"><div className="relative group shrink-0"><div className={`w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden ${isDarkMode ? 'border-stone-700 bg-stone-800' : 'border-stone-300 bg-stone-50'}`}>{newLogo ? <img src={newLogo} alt="Logo" className="w-full h-full object-cover" /> : <Upload size={16} className="text-stone-400" />}</div><input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" title="Upload Logo (Max 100KB)" /></div><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Client Name..." className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-white border-stone-200'}`} /></div></div>
                        <div><label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Color Theme</label><div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">{colorOptions.map((c) => <button key={c.key} onClick={() => setNewColor(c.key)} className={`w-8 h-8 rounded-full border-2 flex-shrink-0 transition-all ${c.previewClass} ${newColor === c.key ? 'ring-2 ring-offset-2 ring-teal-500 border-transparent scale-110' : 'border-transparent opacity-60 hover:opacity-100'} ${isDarkMode ? 'ring-offset-stone-900' : 'ring-offset-white'}`} title={c.key.charAt(0).toUpperCase() + c.key.slice(1)} />)}</div></div>
                        <button onClick={handleAdd} disabled={!newName.trim()} className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-teal-700 transition-colors">Add Client</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">{clients.map(c => <div key={c.id} className={`flex justify-between items-center p-2 rounded border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-100'}`}><div className="flex items-center gap-2">{c.logo ? <img src={c.logo} alt="Logo" className="w-6 h-6 rounded object-cover border border-stone-200" /> : <div className={`w-3 h-3 rounded-full ${THEME_COLORS[c.color] ? THEME_COLORS[c.color].preview : 'bg-stone-400'}`}></div>}<span className={`text-sm ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>{c.name}</span></div><button onClick={() => setClients(clients.filter(x => x.id !== c.id))} className="text-stone-400 hover:text-rose-500"><Trash2 size={14}/></button></div>)}</div>
                </div>
            </div>
        </div>
    );
};

// --- 6. Main App Component ---

const NeuroFlowApp = () => {
  const [user, setUser] = useState(null);
  const [googleToken, setGoogleToken] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [data, setData] = useState(INITIAL_DATA);
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [activeTimers, setActiveTimers] = useState([]);
  const [focusId, setFocusId] = useState(null); 
  
  // UI State
  const [viewMode, setViewMode] = useState('map'); 
  const [showClientManager, setShowClientManager] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  
  // New state to track return flow
  const [draftTitle, setDraftTitle] = useState('');
  const [returnToTask, setReturnToTask] = useState(false);

  const [inspectedNode, setInspectedNode] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.8 }); 
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const timerRef = useRef(null);

  // --- Auth & Data Loading ---
  useEffect(() => {
      if (!auth) return;
      const initAuth = async () => {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
              try { await signInWithCustomToken(auth, __initial_auth_token); } catch (e) { console.error("Auth Token Init Error:", e); }
          }
      };
      initAuth();
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          if (currentUser) {
              const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'neuroflow_data', 'main');
              const unsubData = onSnapshot(docRef, (snapshot) => {
                  if (snapshot.exists()) {
                      const d = snapshot.data();
                      if (d.tasks) setData({ ...d, tasks: sanitizeTasks(d.tasks) });
                      if (d.clients) setClients(migrateClients(d.clients));
                      if (d.settings && d.settings.theme) setIsDarkMode(d.settings.theme === 'dark');
                  }
              });
              return () => unsubData();
          } else {
              const saved = localStorage.getItem('neuroflow-radial');
              const savedClients = localStorage.getItem('neuroflow-clients');
              const savedTheme = localStorage.getItem('neuroflow-theme');
              if (saved) setData(JSON.parse(saved));
              if (savedClients) setClients(migrateClients(JSON.parse(savedClients)));
              if (savedTheme) setIsDarkMode(savedTheme === 'dark');
          }
      });
      return () => unsubscribe();
  }, []);

  // --- Data Saving (Debounced) ---
  useEffect(() => {
      const saveData = async () => {
          try {
              if (user && db) {
                  const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'neuroflow_data', 'main');
                  const cleanTasks = JSON.parse(JSON.stringify(data.tasks, (k, v) => v === undefined ? null : v));
                  await setDoc(docRef, { tasks: cleanTasks, clients, weekOffset: data.weekOffset, settings: { theme: isDarkMode ? 'dark' : 'light' } }, { merge: true });
              } else {
                  localStorage.setItem('neuroflow-radial', JSON.stringify(data));
                  localStorage.setItem('neuroflow-clients', JSON.stringify(clients));
                  localStorage.setItem('neuroflow-theme', isDarkMode ? 'dark' : 'light');
              }
          } catch (e) { console.error("Save Data Error:", e); }
      };
      const timeout = setTimeout(saveData, 1000);
      return () => clearTimeout(timeout);
  }, [data, clients, user, isDarkMode]);

  // --- Logic ---
  const loginWithGoogle = async () => {
      if (!auth || !provider) { alert("Firebase not configured. Check console."); return; }
      try {
          const result = await signInWithPopup(auth, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          setGoogleToken(credential.accessToken);
          setUser(result.user);
      } catch (error) { console.error("Login failed:", error); alert("Login failed. See console."); }
  };
  const exportToCalendar = async (node) => {
      if (!googleToken) { alert("Please sign in with Google (top right) to use Calendar features."); return; }
      const durationSeconds = node.timeSpent || 3600;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + durationSeconds * 1000);
      const event = { summary: `NeuroFlow: ${node.text || 'Task'}`, description: ` tracked via NeuroFlow.`, start: { dateTime: startTime.toISOString() }, end: { dateTime: endTime.toISOString() } };
      try {
          const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST', headers: { 'Authorization': `Bearer ${googleToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event)
          });
          if (response.ok) alert("Event added to Google Calendar!"); else { const err = await response.json(); console.error(err); alert("Failed to add event."); }
      } catch (e) { console.error(e); alert("Network error."); }
  };

  useEffect(() => {
    if (activeTimers.length > 0) {
      timerRef.current = setInterval(() => {
        setData(prevData => {
          if (!prevData || !prevData.tasks) return prevData;
          const updateTime = (nodes) => nodes.map(node => {
              let updatedNode = { ...node };
              if (activeTimers.includes(node.id)) updatedNode.timeSpent += 1;
              if (node.children) updatedNode.children = updateTime(node.children);
              return updatedNode;
          });
          return { ...prevData, tasks: updateTime(prevData.tasks) };
        });
      }, 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [activeTimers]);

  const handleTimerToggle = (id) => {
    if (activeTimers.includes(id)) {
        const updateSessionEnd = (nodes) => nodes.map(n => {
            if (n.id === id) {
                const sessions = [...(n.sessions || [])];
                if (sessions.length > 0 && !sessions[sessions.length - 1].end) sessions[sessions.length - 1].end = new Date().toISOString();
                return { ...n, sessions };
            }
            if (n.children) return { ...n, children: updateSessionEnd(n.children) };
            return n;
        });
        setData(prev => ({ ...prev, tasks: updateSessionEnd(prev.tasks || []) }));
        setActiveTimers(prev => prev.filter(timerId => timerId !== id));
    } else {
        const updateSessionStart = (nodes) => nodes.map(n => {
            if (n.id === id) {
                const sessions = [...(n.sessions || []), { start: new Date().toISOString(), end: null }];
                return { ...n, sessions };
            }
            if (n.children) return { ...n, children: updateSessionStart(n.children) };
            return n;
        });
        setData(prev => ({ ...prev, tasks: updateSessionStart(prev.tasks || []) }));
        setActiveTimers(prev => [...prev, id]);
    }
  };

  const updateNode = (id, updates) => {
    if (id === null) { setInspectedNode(null); return; }
    if (inspectedNode && inspectedNode.id === id) setInspectedNode(prev => ({ ...prev, ...updates }));
    const updateRecursive = (nodes) => nodes.map(node => {
        if (node.id === id) return { ...node, ...updates };
        if (node.children) return { ...node, children: updateRecursive(node.children) };
        return node;
    });
    setData(prev => ({ ...prev, tasks: updateRecursive(prev.tasks || []) }));
  };

  const addChild = (parentId, initialData = {}) => {
    let targetId = parentId;
    
    // CASE A: Add Task from Modal (specific client requested)
    if (targetId === null && initialData.clientId) {
        // Look for existing node for this client
        const existingNode = data.tasks.find(n => n.type === 'client' && n.clientId === initialData.clientId);
        if (existingNode) {
            // Found it, so we are actually adding a task to this existing client node
            targetId = existingNode.id;
        }
        // If not found, targetId remains null, meaning we create a new Client Node + Task
    }

    // CASE B: Generic Add (Central Button) - No specific client
    // We want to find the next available client
    if (targetId === null && !initialData.clientId) {
         const usedClientIds = data.tasks.filter(t => t.type === 'client').map(t => t.clientId);
         const nextClient = clients.find(c => !usedClientIds.includes(c.id));
         
         if (nextClient) {
             // We found an unused client. We will create a new Client Node for them.
             // We inject the clientId into initialData so the creation logic below picks it up
             initialData.clientId = nextClient.id; 
         } else {
             // No unused clients. Open manager.
             setShowClientManager(true);
             return;
         }
    }
    
    const isRootAdd = targetId === null;
    const newNode = {
      id: generateId(), 
      text: initialData.text || '', 
      type: isRootAdd ? 'client' : 'task', 
      completed: false, 
      expanded: true, 
      timeSpent: 0, 
      sessions: [],
      createdAt: new Date().toISOString(), 
      clientId: isRootAdd ? (initialData.clientId || clients[0].id) : null, 
      children: []
    };

    if (isRootAdd) {
        if (initialData.text) {
             newNode.children = [{ id: generateId(), text: initialData.text, type: 'task', completed: false, expanded: true, timeSpent: 0, sessions: [], createdAt: new Date().toISOString(), children: [] }];
        } else {
             newNode.children.push({ id: generateId(), text: '', type: 'task', completed: false, expanded: true, timeSpent: 0, sessions: [], createdAt: new Date().toISOString(), children: [] });
        }
        setData(prev => ({ ...prev, tasks: [...(prev.tasks || []), newNode] }));
    } else {
      const taskNode = isRootAdd ? null : {
          id: generateId(), text: initialData.text || '', type: 'task', completed: false, expanded: true, timeSpent: 0, sessions: [], createdAt: new Date().toISOString(), children: []
      };
      const addRecursive = (nodes) => nodes.map(node => {
          if (node.id === targetId) return { ...node, expanded: true, children: [...node.children, taskNode || newNode] };
          if (node.children) return { ...node, children: addRecursive(node.children) };
          return node;
      });
      setData(prev => ({ ...prev, tasks: addRecursive(prev.tasks || []) }));
    }
  };

  const deleteNode = (id) => { setDeleteTarget(id); };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    const deleteRecursive = (nodes) => nodes.filter(node => node.id !== deleteTarget).map(node => ({ ...node, children: node.children ? deleteRecursive(node.children) : [] }));
    setData(prev => ({ ...prev, tasks: deleteRecursive(prev.tasks || []) }));
    setDeleteTarget(null); setInspectedNode(null);
  };
  const getCurrentWeekLabel = () => {
    if (!data) return { start: '', end: '' };
    const d = new Date(); d.setDate(d.getDate() + (data.weekOffset * 7));
    const startOfWeek = d.getDate() - d.getDay(); const date = new Date(d.setDate(startOfWeek)); const end = new Date(d.setDate(date.getDate() + 6));
    return { start: formatDate(date), end: formatDate(end) }
  };
  const weekData = getCurrentWeekLabel();

  // --- Modal Logic with Context Switching ---
  const handleSwitchToClientManager = (currentTitle) => {
      setDraftTitle(currentTitle);
      setReturnToTask(true);
      setShowAddTaskModal(false);
      setShowClientManager(true);
  };

  const handleClientManagerClose = () => {
      setShowClientManager(false);
      if (returnToTask) {
          setShowAddTaskModal(true);
          setReturnToTask(false);
      }
  };

  const handleFocus = () => {
      if (focusId) { setFocusId(null); return; }
      const debtTasks = [];
      const collectDebt = (nodes) => {
          nodes.forEach(n => {
              if (n.type === 'task' && !n.completed) {
                  const age = getTaskAge(n.createdAt);
                  if (age > 3) debtTasks.push(n);
              }
              if (n.children) collectDebt(n.children);
          });
      };
      if (data.tasks) collectDebt(data.tasks);
      if (debtTasks.length > 0) {
          const randomTask = debtTasks[Math.floor(Math.random() * debtTasks.length)];
          setFocusId(randomTask.id);
      } else {
          const allTasks = [];
          const collectAll = (nodes) => {
               nodes.forEach(n => {
                  if (n.type === 'task' && !n.completed) allTasks.push(n);
                  if (n.children) collectAll(n.children);
              });
          };
          if (data.tasks) collectAll(data.tasks);
          if (allTasks.length > 0) {
               const randomTask = allTasks[Math.floor(Math.random() * allTasks.length)];
               setFocusId(randomTask.id);
          } else { alert("No tasks to focus on! Great job."); }
      }
  };

  // --- Interactions ---
  const handleTouchStart = (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return; const touch = e.touches[0]; setIsDragging(true); setLastMouse({ x: touch.clientX, y: touch.clientY }); };
  const handleTouchMove = (e) => { if (!isDragging) return; const touch = e.touches[0]; const dx = touch.clientX - lastMouse.x; const dy = touch.clientY - lastMouse.y; setLastMouse({ x: touch.clientX, y: touch.clientY }); setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); };
  const handleMouseDown = (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return; setIsDragging(true); setLastMouse({ x: e.clientX, y: e.clientY }); };
  const handleMouseMove = (e) => { if (!isDragging) return; const dx = e.clientX - lastMouse.x; const dy = e.clientY - lastMouse.y; setLastMouse({ x: e.clientX, y: e.clientY }); setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); };

  // --- Filtering ---
  const filterIncompleteTree = (nodes) => {
      return nodes.reduce((acc, node) => {
          const filteredChildren = filterIncompleteTree(node.children || []);
          if (node.type === 'client') {
              if (filteredChildren.length > 0) acc.push({ ...node, children: filteredChildren });
          } else {
              if (!node.completed || filteredChildren.length > 0) acc.push({ ...node, children: filteredChildren });
          }
          return acc;
      }, []);
  };
  const displayNodes = data?.weekOffset > 0 ? filterIncompleteTree(data.tasks || []) : (data.tasks || []);
  const leftNodes = displayNodes.filter((_, i) => i % 2 !== 0);
  const rightNodes = displayNodes.filter((_, i) => i % 2 === 0);
  const controlBtnClass = `p-3 rounded-full shadow-md border transition-colors ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200 hover:bg-stone-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`;

  return (
    <div 
        className={`w-full h-screen overflow-hidden relative font-sans transition-colors duration-500 ${isDarkMode ? 'bg-[#1c1917] selection:bg-teal-900' : 'bg-[#F7F5F2] selection:bg-teal-200'} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={(e) => { if (viewMode==='map') { const s = -e.deltaY * 0.001; setView(p => ({...p, scale: Math.min(Math.max(0.1, p.scale + s), 3)})) }}} 
        onMouseDown={viewMode==='map' ? handleMouseDown : undefined} 
        onMouseMove={viewMode==='map' ? handleMouseMove : undefined} 
        onMouseUp={() => setIsDragging(false)} 
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={viewMode==='map' ? handleTouchStart : undefined}
        onTouchMove={viewMode==='map' ? handleTouchMove : undefined}
        onTouchEnd={() => setIsDragging(false)}
    >
      <TreeStyles isDarkMode={isDarkMode} />
      <div className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #888 1.5px, transparent 1.5px)', backgroundSize: '24px 24px', transform: viewMode==='map' ? `translate(${view.x}px, ${view.y}px) scale(${view.scale})` : 'none' }}></div>
      
      {/* Title Bar */}
      <TitleBar user={user} isDarkMode={isDarkMode} loginWithGoogle={loginWithGoogle} logout={() => { signOut(auth); setUser(null); }} />

      {/* Top Right Controls */}
      <div className="absolute top-16 right-6 z-[90] flex flex-col gap-3" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
         <button onClick={handleFocus} className={`${controlBtnClass} ${focusId ? 'bg-amber-100 text-amber-600 border-amber-300 ring-2 ring-amber-400' : ''}`} title="Focus Mode"><Zap size={20} className={focusId ? 'fill-current animate-pulse' : ''} /></button>
         <button onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')} className={controlBtnClass} title={viewMode === 'map' ? 'Switch to List' : 'Switch to Map'}>{viewMode === 'map' ? <List size={20} /> : <Share2 size={20} />}</button>
         <button onClick={() => setIsDarkMode(!isDarkMode)} className={controlBtnClass} title="Toggle Theme">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
         {viewMode === 'map' && <button onClick={() => setView({x:0, y:0, scale: 0.8})} className={controlBtnClass} title="Reset View"><Maximize size={20} /></button>}
         <button onClick={() => setShowReportModal(true)} className={controlBtnClass} title="Export Time Report"><FileText size={20} /></button>
         <button onClick={() => setShowClientManager(true)} className={controlBtnClass} title="Manage Clients"><UserPlus size={20} /></button>
      </div>

      {/* View Content */}
      {viewMode === 'map' ? (
          <div className="absolute left-1/2 top-1/2 origin-center will-change-transform" style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.scale})` }}>
            <div className="flex items-center justify-center min-w-max min-h-max p-32">
                <div className="flex items-center mr-6 relative">
                    <div className="mm-children-left pr-12">
                        {leftNodes.map(node => <ClientNode key={node.id} node={node} direction="left" clients={clients} onUpdate={updateNode} onAddChild={addChild} onDelete={deleteNode} onTimerToggle={handleTimerToggle} activeTimers={activeTimers} openClientManager={() => setShowClientManager(true)} isDarkMode={isDarkMode} onInspect={setInspectedNode} focusId={focusId} />)}
                    </div>
                </div>
                {/* Central Hub */}
                <div 
                    className={`relative z-[60] w-64 h-64 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.1)] border-[6px] flex flex-col items-center justify-center group select-none shrink-0 transition-colors ${isDarkMode ? 'bg-stone-800 border-stone-900' : 'bg-stone-50 border-white'} ${focusId ? 'opacity-20 blur-sm' : 'opacity-100'}`} 
                    onMouseDown={e => e.stopPropagation()}
                >
                    <div className={`absolute -inset-4 border-2 border-dashed rounded-full animate-[spin_60s_linear_infinite] pointer-events-none ${isDarkMode ? 'border-stone-700' : 'border-stone-300/60'}`}></div>
                    <div className="text-center z-10">
                        <div className={`text-xs font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Current Week</div>
                        <div className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-stone-200' : 'text-stone-700'}`}>{weekData.start}</div>
                        <div className={`h-1 w-12 rounded-full my-2 mx-auto ${isDarkMode ? 'bg-stone-700' : 'bg-stone-200'}`}></div>
                        <div className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-stone-200' : 'text-stone-700'}`}>{weekData.end}</div>
                    </div>
                    <div className="absolute flex justify-between w-[115%] top-1/2 -translate-y-1/2">
                        <button onClick={() => setData(d => ({...d, weekOffset: d.weekOffset - 1}))} className={`p-2.5 rounded-full shadow-md border transition-colors ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-500 hover:text-teal-400 hover:bg-stone-700' : 'bg-white border-stone-100 text-stone-400 hover:text-teal-600'}`}><ChevronRight className="rotate-180" size={24}/></button>
                        <button onClick={() => setData(d => ({...d, weekOffset: d.weekOffset + 1}))} className={`p-2.5 rounded-full shadow-md border transition-colors ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-500 hover:text-teal-400 hover:bg-stone-700' : 'bg-white border-stone-100 text-stone-400 hover:text-teal-600'}`}><ChevronRight size={24}/></button>
                    </div>
                    <button onClick={() => addChild(null)} className={`absolute -bottom-8 w-16 h-16 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all border-[6px] z-[60] ${isDarkMode ? 'bg-teal-700 text-white border-[#1c1917] hover:bg-teal-600' : 'bg-stone-800 text-stone-50 border-[#F7F5F2] hover:bg-teal-600'}`}><Plus size={32} strokeWidth={2.5} /></button>
                </div>
                <div className="flex items-center ml-6 relative">
                    <div className="mm-children-right pl-12">
                        {rightNodes.map(node => <ClientNode key={node.id} node={node} direction="right" clients={clients} onUpdate={updateNode} onAddChild={addChild} onDelete={deleteNode} onTimerToggle={handleTimerToggle} activeTimers={activeTimers} openClientManager={() => setShowClientManager(true)} isDarkMode={isDarkMode} onInspect={setInspectedNode} focusId={focusId} />)}
                    </div>
                </div>
            </div>
          </div>
      ) : (
          <div className="absolute inset-0 top-14 pt-8 px-4 sm:px-12 overflow-y-auto z-10" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
              <div className="max-w-3xl mx-auto space-y-6 pb-20">
                  {/* List View Controls (Week Nav in List Mode) */}
                  <div className={`flex items-center justify-between p-4 rounded-xl shadow-sm mb-6 border ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
                      <button onClick={() => setData(d => ({...d, weekOffset: d.weekOffset - 1}))} className={`p-2 rounded-lg ${isDarkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}><ChevronLeft size={20}/></button>
                      <div className="text-center">
                          <div className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Current Week</div>
                          <div className={`text-lg font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{weekData.start} — {weekData.end}</div>
                      </div>
                      <button onClick={() => setData(d => ({...d, weekOffset: d.weekOffset + 1}))} className={`p-2 rounded-lg ${isDarkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}><ChevronRight size={20}/></button>
                  </div>

                  {displayNodes.map(node => (
                      <ListViewClient 
                          key={node.id} 
                          node={node} 
                          clients={clients} 
                          onUpdate={updateNode} 
                          onAddChild={addChild} 
                          onDelete={deleteNode} 
                          onTimerToggle={handleTimerToggle} 
                          activeTimers={activeTimers} 
                          openClientManager={() => setShowClientManager(true)} 
                          isDarkMode={isDarkMode} 
                          onInspect={setInspectedNode} 
                          focusId={focusId}
                      />
                  ))}
                  {displayNodes.length === 0 && <div className="text-center text-stone-500 py-10">No tasks for this week.</div>}
              </div>
          </div>
      )}

      {/* Floating Action Button */}
      <button 
        onClick={() => setShowAddTaskModal(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-2xl flex items-center justify-center z-[90] transition-transform hover:scale-105 active:scale-95"
      >
        <Plus size={32} />
      </button>

      <ReportModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} data={data} clients={clients} isDarkMode={isDarkMode} />
      <AddTaskModal 
          isOpen={showAddTaskModal} 
          onClose={() => setShowAddTaskModal(false)} 
          clients={clients} 
          tasks={data.tasks} 
          onAdd={addChild} 
          isDarkMode={isDarkMode} 
          onSwitchToClientManager={handleSwitchToClientManager} 
          initialTitle={draftTitle} 
      />
      
      {/* Client Manager last in DOM for stacking */}
      <ClientManagerModal isOpen={showClientManager} onClose={handleClientManagerClose} clients={clients} setClients={setClients} isDarkMode={isDarkMode} />

      {inspectedNode && <InspectorPanel node={inspectedNode} onUpdate={updateNode} onDelete={deleteNode} isDarkMode={isDarkMode} clients={clients} onExportCalendar={exportToCalendar} onClose={() => setInspectedNode(null)} />}
      
      {deleteTarget && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
        >
           <div className={`rounded-xl p-6 max-w-sm w-full shadow-2xl ${isDarkMode ? 'bg-stone-900 border border-stone-800' : 'bg-white'}`}>
              <h3 className={`font-bold text-lg mb-2 ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>Delete Branch?</h3>
              <p className={`mb-6 text-sm ${isDarkMode ? 'text-stone-400' : 'text-stone-600'}`}>This will permanently delete this item and all its sub-tasks. This cannot be undone.</p>
              <div className="flex justify-end gap-3">
                 <button onClick={() => setDeleteTarget(null)} className={`px-4 py-2 rounded-lg ${isDarkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-600 hover:bg-stone-100'}`}>Cancel</button>
                 <button onClick={confirmDelete} className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700">Delete</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// Wrap with ErrorBoundary for production safety
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="p-10 text-center"><h1>Something went wrong.</h1><button onClick={() => window.location.reload()} className="mt-4 p-2 bg-gray-200 rounded">Reload</button></div>;
    return this.props.children; 
  }
}

export default function App() {
    return (
        <ErrorBoundary>
            <NeuroFlowApp />
        </ErrorBoundary>
    );
}