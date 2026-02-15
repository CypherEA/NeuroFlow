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
  MoreHorizontal
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
 * NeuroFlow Week Planner - Fixed Version
 * Features: 
 * - Inline Inputs & Dropdowns
 * - Google Sign-In & Calendar OAuth
 * - Firestore Real-time Sync
 */

// --- 0. Firebase Setup (Production) ---
let app, auth, db, provider;
let appId = 'neuroflow-prod'; 

try {
    // Vercel/Vite exposes env vars via import.meta.env
    const configRaw = import.meta.env.VITE_FIREBASE_CONFIG;

    if (configRaw) {
        const firebaseConfig = JSON.parse(configRaw);
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        provider = new GoogleAuthProvider();
        // CORRECTED LINE: Clean URL string (No markdown syntax)
        provider.addScope('https://www.googleapis.com/auth/calendar.events');
    } else {
        console.warn("VITE_FIREBASE_CONFIG is missing. Auth will fail.");
    }
} catch (e) {
    console.error("Firebase init failed:", e);
}

// --- 1. Utility Functions ---

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
        if (c.color && c.color.includes('bg-')) {
            if (c.color.includes('teal')) return { ...c, color: 'teal' };
            if (c.color.includes('indigo')) return { ...c, color: 'indigo' };
            if (c.color.includes('rose')) return { ...c, color: 'rose' };
            if (c.color.includes('amber')) return { ...c, color: 'amber' };
            if (c.color.includes('emerald')) return { ...c, color: 'emerald' };
            return { ...c, color: 'stone' };
        }
        return c;
    });
};

// --- 2. Initial Data ---

const INITIAL_CLIENTS = [
  { id: 'c1', name: 'Internal', color: 'stone' },
  { id: 'c2', name: 'Client A', color: 'teal' },
  { id: 'c3', name: 'Client B', color: 'indigo' },
];

const INITIAL_DATA = {
  weekOffset: 0, 
  tasks: [
    {
      id: 'root-1', text: '', type: 'client', completed: false, expanded: true, timeSpent: 0, sessions: [], clientId: 'c2',
      children: [
        { id: 't-1', text: 'Design Phase', type: 'task', completed: false, expanded: true, timeSpent: 0, sessions: [],
          children: []
        }
      ]
    }
  ]
};

// --- 3. Theme System ---
const THEME_COLORS = {
    stone: { light: 'bg-stone-200 border-stone-300 text-stone-800', dark: 'bg-stone-800 border-stone-600 text-stone-200' },
    teal: { light: 'bg-teal-100 border-teal-300 text-teal-900', dark: 'bg-teal-900/40 border-teal-700 text-teal-100' },
    indigo: { light: 'bg-indigo-100 border-indigo-300 text-indigo-900', dark: 'bg-indigo-900/40 border-indigo-700 text-indigo-100' },
    rose: { light: 'bg-rose-100 border-rose-300 text-rose-900', dark: 'bg-rose-900/40 border-rose-700 text-rose-100' },
    amber: { light: 'bg-amber-100 border-amber-300 text-amber-900', dark: 'bg-amber-900/40 border-amber-700 text-amber-100' },
    emerald: { light: 'bg-emerald-100 border-emerald-300 text-emerald-900', dark: 'bg-emerald-900/40 border-emerald-700 text-emerald-100' }
};

const getThemeClasses = (colorKey, isDarkMode) => {
    const key = THEME_COLORS[colorKey] ? colorKey : 'stone';
    return isDarkMode ? THEME_COLORS[key].dark : THEME_COLORS[key].light;
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

const InspectorPanel = ({ node, onUpdate, onDelete, isDarkMode, clients, onExportCalendar, onClose }) => {
    if (!node) return null;
    const client = clients.find(c => c.id === node.clientId);
    const isClient = node.type === 'client';

    return (
        <div className={`fixed right-0 top-0 h-full w-80 shadow-2xl border-l z-[60] transform transition-transform duration-300 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                <h3 className={`font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{isClient ? 'Client Details' : 'Task Details'}</h3>
                <button onClick={onClose} className={isDarkMode ? 'text-stone-500 hover:text-stone-300' : 'text-stone-400 hover:text-stone-600'}><X size={18}/></button>
            </div>
            
            <div className="p-6 space-y-6">
                <div>
                    <label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Total Duration</label>
                    <div className={`p-3 rounded-lg border font-mono text-lg font-bold ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-stone-50 border-stone-200 text-stone-800'}`}>
                        {formatTime(node.timeSpent)}
                    </div>
                </div>

                {!isClient && (
                    <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-200'}`}>
                        <button 
                            onClick={() => onExportCalendar(node)}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                            <CalendarCheck size={14} /> Push to Calendar
                        </button>
                        <p className="text-[10px] text-center mt-2 text-stone-500">Creates a 1hr event (or duration) on GCal</p>
                    </div>
                )}

                <div className="pt-4 border-t border-stone-200/10">
                    <button onClick={() => onDelete(node.id)} className="w-full py-2 flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-sm font-medium">
                        <Trash2 size={16}/> Delete Branch
                    </button>
                </div>
            </div>
        </div>
    );
};

const ReportModal = ({ isOpen, onClose, data, clients, isDarkMode }) => {
    const formatLocalDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getFirstDay = () => {
        const d = new Date();
        return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
    };
    const getLastDay = () => {
        const d = new Date();
        return formatLocalDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    };

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

                    const filterStart = new Date(startDate);
                    filterStart.setHours(0, 0, 0, 0);
                    const filterEnd = new Date(endDate);
                    filterEnd.setHours(23, 59, 59, 999);

                    if (sStart <= filterEnd && sEnd >= filterStart) {
                        const overlapStart = new Date(Math.max(sStart.getTime(), filterStart.getTime()));
                        const overlapEnd = new Date(Math.min(sEnd.getTime(), filterEnd.getTime()));
                        const validTime = (overlapEnd - overlapStart) / 1000; 
                        
                        if (validTime > 0) {
                            reportData.push({
                                taskName: node.text || 'Unnamed Task',
                                clientName: clientObj.name,
                                start: overlapStart,
                                end: overlapEnd,
                                duration: validTime
                            });
                        }
                    }
                });
            }
        }

        if (node.children) {
            node.children.forEach(child => traverse(child, effectiveClientId));
        }
    };

    if (data && data.tasks) {
        data.tasks.forEach(rootNode => traverse(rootNode, rootNode.clientId));
    }

    const aggregated = reportData.reduce((acc, row) => {
        if (!acc[row.clientName]) acc[row.clientName] = 0;
        acc[row.clientName] += row.duration;
        return acc;
    }, {});

    const handleExport = () => {
        let csvContent = "data:text/csv;charset=utf-8,Client,Task,Start Time,End Time,Duration (HH:MM:SS),Duration (Seconds)\n";
        
        const formatDateTime = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            const s = String(d.getSeconds()).padStart(2, '0');
            return `${y}-${m}-${day} ${h}:${min}:${s}`;
        };

        reportData.forEach(row => {
            const hours = Math.floor(row.duration / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((row.duration % 3600) / 60).toString().padStart(2, '0');
            const seconds = Math.floor(row.duration % 60).toString().padStart(2, '0');
            const durationStr = `${hours}:${minutes}:${seconds}`;
            const safeTaskName = row.taskName.replace(/"/g, '""');
            const startStr = formatDateTime(row.start);
            const endStr = formatDateTime(row.end);
            
            csvContent += `"${row.clientName}","${safeTaskName}","${startStr}","${endStr}","${durationStr}",${Math.round(row.duration)}\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `NeuroFlow_Report_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const inputClass = `w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-white border-stone-200'}`;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 text-left" onWheel={(e) => e.stopPropagation()}>
            <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ${isDarkMode ? 'bg-stone-900 border border-stone-800' : 'bg-white'}`}>
                <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-100'}`}>
                    <h3 className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}><Calendar size={18} /> Export Report</h3>
                    <button onClick={onClose} className={isDarkMode ? 'text-stone-400 hover:text-white' : 'text-stone-400 hover:text-black'}><X size={18} /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>From</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
                            </div>
                            <div className="flex-1">
                                <label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>To</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
                            </div>
                        </div>
                        <div>
                            <label className={`text-xs font-bold uppercase block mb-1 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Filter</label>
                            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className={inputClass}>
                                <option value="ALL">All Clients & Projects</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-200'}`}>
                            <h4 className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>Summary</h4>
                            {Object.keys(aggregated).length === 0 ? (
                                <p className="text-xs text-stone-500 italic">No time tracked in this period.</p>
                            ) : (
                                <ul className="space-y-1.5">
                                    {Object.entries(aggregated).map(([clientName, duration]) => (
                                        <li key={clientName} className="flex justify-between text-sm">
                                            <span className={`${isDarkMode ? 'text-stone-400' : 'text-stone-600'} font-medium`}>{clientName}</span>
                                            <span className={`font-mono font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>{formatTime(duration)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <button onClick={handleExport} disabled={reportData.length === 0} className="w-full bg-teal-600 text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                            <Download size={18} /> Download CSV Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ClientManagerModal = ({ isOpen, onClose, clients, setClients, isDarkMode }) => {
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('stone');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onWheel={e => e.stopPropagation()}>
            <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white'}`}>
                <div className="p-4 border-b border-stone-200/10 flex justify-between items-center">
                    <h3 className={`font-bold flex gap-2 ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}><Users size={18}/> Clients</h3>
                    <button onClick={onClose}><X size={18} className="text-stone-400"/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex gap-2">
                        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New Client Name..." className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-white border-stone-200'}`} />
                        <button onClick={() => { if(newName.trim()) { setClients([...clients, { id: generateId(), name: newName, color: newColor }]); setNewName(''); }}} className="bg-teal-600 text-white px-4 rounded-lg text-sm font-bold">Add</button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {clients.map(c => (
                            <div key={c.id} className={`flex justify-between p-2 rounded border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-100'}`}>
                                <span className={`text-sm ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>{c.name}</span>
                                <button onClick={() => setClients(clients.filter(x => x.id !== c.id))} className="text-stone-400 hover:text-rose-500"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Timer = ({ isRunning, timeSpent, onToggle, isDarkMode }) => (
    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-all border ${isRunning ? 'bg-rose-500 text-white border-rose-600 shadow-inner' : isDarkMode ? 'bg-stone-800 text-stone-400 border-stone-700 hover:border-teal-700 hover:text-teal-400' : 'bg-stone-100 text-stone-500 border-stone-200 hover:border-teal-400 hover:text-teal-700'}`}>
      <span>{formatTime(timeSpent)}</span>
      {isRunning ? <Pause size={10} className="fill-current" /> : <Play size={10} className="fill-current" />}
    </button>
);

const TaskNode = ({ node, onUpdate, onAddChild, onDelete, onTimerToggle, activeTimers, direction, isDarkMode, onInspect }) => {
    if (!node) return null;
    const isRunning = activeTimers.includes(node.id);
    const baseCard = isDarkMode ? 'bg-stone-800 border-stone-700 shadow-stone-900/20' : 'bg-stone-50 border-stone-300 shadow-sm';
    const focusRing = 'focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent';
    const inputColor = isDarkMode ? 'text-stone-200 placeholder-stone-600' : 'text-stone-800 placeholder-stone-400';
    const completedText = isDarkMode ? 'line-through text-stone-600' : 'line-through text-stone-400';
    
    return (
        <div className={`mm-child-${direction}`}>
            <div 
                className={`flex flex-col gap-1 p-3 rounded-xl border shadow-sm relative z-20 shrink-0 w-56 transition-all ${focusRing} ${node.completed ? 'opacity-60 grayscale' : ''} ${baseCard}`}
            >
                <div className="flex w-full items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { completed: !node.completed }); }} className={`w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center transition-colors ${node.completed ? 'bg-teal-600 border-teal-600 text-white' : 'border-stone-400 bg-transparent hover:border-teal-500'}`}>
                        {node.completed && <Check size={12} strokeWidth={4} />}
                    </button>
                    {/* Inline Input for Task Title */}
                    <input 
                        type="text" 
                        value={node.text} 
                        onChange={(e) => onUpdate(node.id, { text: e.target.value })} 
                        className={`bg-transparent outline-none flex-1 text-sm font-semibold ${node.completed ? completedText : inputColor}`} 
                        placeholder="Task..." 
                    />
                </div>
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
                        <TaskNode key={child.id} node={child} onUpdate={onUpdate} onAddChild={onAddChild} onDelete={onDelete} onTimerToggle={onTimerToggle} activeTimers={activeTimers} direction={direction} isDarkMode={isDarkMode} onInspect={onInspect} />
                    ))}
                </div>
            )}
        </div>
    );
};

const ClientNode = ({ node, direction, clients, onUpdate, onAddChild, onDelete, onTimerToggle, activeTimers, openClientManager, isDarkMode, onInspect }) => {
    if (!node) return null;
    const client = (clients && clients.length > 0) ? (clients.find(c => c.id === node.clientId) || clients[0]) : { color: 'stone' };
    const themeClass = getThemeClasses(client.color, isDarkMode);

    const handleClientChange = (e) => {
        if (e.target.value === 'ADD_NEW') openClientManager();
        else onUpdate(node.id, { clientId: e.target.value });
    };

    return (
        <div className={`mm-child-${direction}`}>
            <div className={`relative z-20 px-4 py-2.5 rounded-full shadow-md border-2 flex items-center gap-2 transition-all hover:scale-[1.02] shrink-0 min-w-[170px] ${themeClass}`}>
                <Briefcase size={18} className="opacity-80 flex-shrink-0" />
                {/* Dropdown for Client Selection */}
                <select 
                    value={node.clientId} 
                    onChange={handleClientChange} 
                    className="bg-transparent font-bold text-sm outline-none cursor-pointer appearance-none truncate flex-1 text-center"
                >
                    {clients && clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option disabled>──────────</option>
                    <option value="ADD_NEW">+ Add New...</option>
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
                        <TaskNode key={child.id} node={child} onUpdate={onUpdate} onAddChild={onAddChild} onDelete={onDelete} onTimerToggle={onTimerToggle} activeTimers={activeTimers} direction={direction} isDarkMode={isDarkMode} onInspect={onInspect} />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- 6. Main App Component ---

const NeuroFlowApp = () => {
  // Auth State
  const [user, setUser] = useState(null);
  const [googleToken, setGoogleToken] = useState(null);

  // App State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [data, setData] = useState(INITIAL_DATA);
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [activeTimers, setActiveTimers] = useState([]);
  
  // UI State
  const [showClientManager, setShowClientManager] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [inspectedNode, setInspectedNode] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.8 }); 
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const timerRef = useRef(null);

  // --- Auth & Data Loading ---
  
  useEffect(() => {
        // SAFETY CHECK: Prevent crash if auth is missing
        if (!auth) {
          console.error("Auth not initialized. Check VITE_FIREBASE_CONFIG.");
          return;
        };
      // 1. Init Auth
      const initAuth = async () => {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
              await signInWithCustomToken(auth, __initial_auth_token);
          }
      };
      initAuth();

      // 2. Listen for User Changes
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          if (currentUser) {
              // Load Data from Firestore
              const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'neuroflow_data', 'main');
              const unsubData = onSnapshot(docRef, (snapshot) => {
                  if (snapshot.exists()) {
                      const d = snapshot.data();
                      if (d.tasks) setData({ ...d, tasks: sanitizeTasks(d.tasks) });
                      if (d.clients) setClients(d.clients);
                  }
              }, (err) => console.log("Read error (expected if new user):", err));
              return () => unsubData();
          } else {
              // Fallback to local storage if logged out
              const saved = localStorage.getItem('neuroflow-radial');
              if (saved) setData(JSON.parse(saved));
          }
      });
      return () => unsubscribe();
  }, []);

  // --- Data Saving (Debounced) ---
  useEffect(() => {
      const saveData = async () => {
          if (user) {
              const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'neuroflow_data', 'main');
              await setDoc(docRef, { tasks: data.tasks, clients, weekOffset: data.weekOffset }, { merge: true });
          } else {
              localStorage.setItem('neuroflow-radial', JSON.stringify(data));
              localStorage.setItem('neuroflow-clients', JSON.stringify(clients));
          }
      };
      const timeout = setTimeout(saveData, 1000);
      return () => clearTimeout(timeout);
  }, [data, clients, user]);

  // --- Google Calendar Sync ---
  const loginWithGoogle = async () => {
      try {
          const result = await signInWithPopup(auth, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          setGoogleToken(credential.accessToken);
          setUser(result.user);
      } catch (error) {
          console.error("Login failed:", error);
          alert("Login failed. See console.");
      }
  };

  const exportToCalendar = async (node) => {
      if (!googleToken) {
          alert("Please sign in with Google (top right) to use Calendar features.");
          return;
      }
      
      const durationSeconds = node.timeSpent || 3600; // Default 1 hour if 0
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

      const event = {
          summary: `NeuroFlow: ${node.text || 'Task'}`,
          description: ` tracked via NeuroFlow.`,
          start: { dateTime: startTime.toISOString() },
          end: { dateTime: endTime.toISOString() }
      };

      try {
          const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${googleToken}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(event)
          });
          
          if (response.ok) {
              alert("Event added to Google Calendar!");
          } else {
              const err = await response.json();
              console.error(err);
              alert("Failed to add event.");
          }
      } catch (e) {
          console.error(e);
          alert("Network error.");
      }
  };

  // --- Logic (Timer, CRUD) ---
  useEffect(() => {
    if (activeTimers.length > 0) {
      timerRef.current = setInterval(() => {
        setData(prevData => {
          if (!prevData || !prevData.tasks) return prevData;
          const updateTime = (nodes) => nodes.map(node => {
              let updatedNode = { ...node };
              if (activeTimers.includes(node.id)) {
                  updatedNode.timeSpent += 1;
              }
              if (node.children) {
                  updatedNode.children = updateTime(node.children);
              }
              return updatedNode;
          });
          return { ...prevData, tasks: updateTime(prevData.tasks) };
        });
      }, 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [activeTimers]);

  const handleTimerToggle = (id) => {
    const now = new Date().toISOString();
    if (activeTimers.includes(id)) {
        // Stop Logic
        const updateSessionEnd = (nodes) => nodes.map(n => {
            if (n.id === id) {
                const sessions = [...(n.sessions || [])];
                if (sessions.length > 0 && !sessions[sessions.length - 1].end) sessions[sessions.length - 1].end = now;
                return { ...n, sessions };
            }
            if (n.children) return { ...n, children: updateSessionEnd(n.children) };
            return n;
        });
        setData(prev => ({ ...prev, tasks: updateSessionEnd(prev.tasks || []) }));
        setActiveTimers(prev => prev.filter(timerId => timerId !== id));
    } else {
        // Start Logic
        const updateSessionStart = (nodes) => nodes.map(n => {
            if (n.id === id) {
                const sessions = [...(n.sessions || []), { start: now, end: null }];
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
    if (id === null) {
        setInspectedNode(null);
        return;
    }
    if (inspectedNode && inspectedNode.id === id) {
        setInspectedNode(prev => ({ ...prev, ...updates }));
    }
    const updateRecursive = (nodes) => nodes.map(node => {
        if (node.id === id) return { ...node, ...updates };
        if (node.children) return { ...node, children: updateRecursive(node.children) };
        return node;
    });
    setData(prev => ({ ...prev, tasks: updateRecursive(prev.tasks || []) }));
  };

  const addChild = (parentId) => {
    const isRootAdd = parentId === null;
    const newNode = {
      id: generateId(), text: '', type: isRootAdd ? 'client' : 'task', completed: false, expanded: true, timeSpent: 0, sessions: [],
      clientId: isRootAdd ? clients[0].id : undefined, children: []
    };
    if (isRootAdd) {
      newNode.children.push({ id: generateId(), text: '', type: 'task', completed: false, expanded: true, timeSpent: 0, sessions: [], children: [] });
      setData(prev => ({ ...prev, tasks: [...(prev.tasks || []), newNode] }));
    } else {
      const addRecursive = (nodes) => nodes.map(node => {
          if (node.id === parentId) return { ...node, expanded: true, children: [...node.children, newNode] };
          if (node.children) return { ...node, children: addRecursive(node.children) };
          return node;
      });
      setData(prev => ({ ...prev, tasks: addRecursive(prev.tasks || []) }));
    }
  };

  const deleteNode = (id) => {
    setDeleteTarget(id);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const deleteRecursive = (nodes) => nodes.filter(node => node.id !== deleteTarget).map(node => ({
        ...node, children: node.children ? deleteRecursive(node.children) : []
    }));
    setData(prev => ({ ...prev, tasks: deleteRecursive(prev.tasks || []) }));
    setDeleteTarget(null);
    setInspectedNode(null);
  };

  const getCurrentWeekLabel = () => {
    if (!data) return { start: '', end: '' };
    const d = new Date();
    d.setDate(d.getDate() + (data.weekOffset * 7));
    const startOfWeek = d.getDate() - d.getDay(); 
    const date = new Date(d.setDate(startOfWeek));
    const end = new Date(d.setDate(date.getDate() + 6));
    return { start: formatDate(date), end: formatDate(end) }
  };
  const weekData = getCurrentWeekLabel();

  // --- Rendering ---
  
  const handleMouseDown = (e) => {
      if (e.target.closest('button, input, select, .z-20, .z-50, .z-60')) return;
      setIsDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setLastMouse({ x: e.clientX, y: e.clientY });
      setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

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
        onWheel={(e) => { const s = -e.deltaY * 0.001; setView(p => ({...p, scale: Math.min(Math.max(0.1, p.scale + s), 3)})) }} 
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}
    >
      <TreeStyles isDarkMode={isDarkMode} />
      <div className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #888 1.5px, transparent 1.5px)', backgroundSize: '24px 24px', transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}></div>
      
      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 z-[100] flex flex-col gap-3" onMouseDown={e => e.stopPropagation()}>
         {!user ? (
             <button onClick={loginWithGoogle} className={`${controlBtnClass} bg-blue-600 text-white hover:bg-blue-700 border-transparent`} title="Connect Google">
                 <Cloud size={20} />
             </button>
         ) : (
             <button onClick={() => { signOut(auth); setUser(null); }} className={`${controlBtnClass} text-rose-500`} title="Sign Out">
                 <LogOut size={20} />
             </button>
         )}
         <button onClick={() => setIsDarkMode(!isDarkMode)} className={controlBtnClass} title="Toggle Theme">
             {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
         </button>
         <button onClick={() => setView({x:0, y:0, scale: 0.8})} className={controlBtnClass} title="Reset View"><Maximize size={20} /></button>
         <button onClick={() => setShowReportModal(true)} className={controlBtnClass} title="Export Time Report"><FileText size={20} /></button>
         <button onClick={() => setShowClientManager(true)} className={controlBtnClass} title="Manage Clients"><UserPlus size={20} /></button>
      </div>

      <div className="absolute left-1/2 top-1/2 origin-center will-change-transform" style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.scale})` }}>
        <div className="flex items-center justify-center min-w-max min-h-max p-32">
            <div className="flex items-center mr-6 relative">
                <div className="mm-children-left pr-12">
                    {leftNodes.map(node => <ClientNode key={node.id} node={node} direction="left" clients={clients} onUpdate={updateNode} onAddChild={addChild} onDelete={deleteNode} onTimerToggle={handleTimerToggle} activeTimers={activeTimers} openClientManager={() => setShowClientManager(true)} isDarkMode={isDarkMode} onInspect={setInspectedNode} />)}
                </div>
            </div>

            <div className={`relative z-50 w-64 h-64 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.1)] border-[6px] flex flex-col items-center justify-center group select-none shrink-0 transition-colors ${isDarkMode ? 'bg-stone-800 border-stone-900' : 'bg-stone-50 border-white'}`} onMouseDown={e => e.stopPropagation()}>
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
                <button onClick={() => addChild(null)} className={`absolute -bottom-8 w-16 h-16 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all border-[6px] z-50 ${isDarkMode ? 'bg-teal-700 text-white border-[#1c1917] hover:bg-teal-600' : 'bg-stone-800 text-stone-50 border-[#F7F5F2] hover:bg-teal-600'}`}><Plus size={32} strokeWidth={2.5} /></button>
            </div>

            <div className="flex items-center ml-6 relative">
                <div className="mm-children-right pl-12">
                    {rightNodes.map(node => <ClientNode key={node.id} node={node} direction="right" clients={clients} onUpdate={updateNode} onAddChild={addChild} onDelete={deleteNode} onTimerToggle={handleTimerToggle} activeTimers={activeTimers} openClientManager={() => setShowClientManager(true)} isDarkMode={isDarkMode} onInspect={setInspectedNode} />)}
                </div>
            </div>
        </div>
      </div>

      <ClientManagerModal isOpen={showClientManager} onClose={() => setShowClientManager(false)} clients={clients} setClients={setClients} isDarkMode={isDarkMode} />
      <ReportModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} data={data} clients={clients} isDarkMode={isDarkMode} />
      {inspectedNode && <InspectorPanel node={inspectedNode} onUpdate={updateNode} onDelete={deleteNode} isDarkMode={isDarkMode} clients={clients} onExportCalendar={exportToCalendar} onClose={() => setInspectedNode(null)} />}
      
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
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