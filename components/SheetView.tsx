
import React, { useState, useEffect } from 'react';
import { Task, User, Project, Status, Priority } from '../types';

interface SheetViewProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  statuses: Status[];
  priorities: Priority[];
  sheetUrl: string;
  activeTabOverride?: 'tasks' | 'users' | 'projects' | 'config' | 'settings';
  onTabChange?: (tab: 'tasks' | 'users' | 'projects' | 'config' | 'settings') => void;
  onUpdateSheetUrl: (url: string) => void;
  onUpdateTask: (task: Task) => void;
  onUpdateUser: (user: User) => void;
  onAddUser: () => void;
  onUpdateProject: (project: Project) => void;
  onAddProject: () => void;
  onUpdateStatus: (status: Status) => void;
  onAddStatus: () => void;
  onUpdatePriority: (priority: Priority) => void;
  onAddPriority: () => void;
  onAddTask: () => void;
  onDeleteTask: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteStatus: (id: string) => void;
  onDeletePriority: (id: string) => void;
}

const SheetView: React.FC<SheetViewProps> = ({ 
  tasks, users, projects, statuses, priorities, sheetUrl, activeTabOverride, onTabChange,
  onUpdateSheetUrl, onUpdateTask, onUpdateUser, onAddUser, onUpdateProject, onAddProject,
  onUpdateStatus, onAddStatus, onUpdatePriority, onAddPriority,
  onAddTask, onDeleteTask, onDeleteUser, onDeleteProject, onDeleteStatus, onDeletePriority
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'users' | 'projects' | 'config' | 'settings'>('tasks');
  const [tempUrl, setTempUrl] = useState(sheetUrl);

  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);
  
  const handleTabClick = (tab: 'tasks' | 'users' | 'projects' | 'config' | 'settings') => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const handleChange = (id: string, field: keyof Task, value: any) => {
    const task = tasks.find(t => t.id === id);
    if (task) onUpdateTask({ ...task, [field]: value });
  };

  const handleSubtaskTextChange = (taskId: string, newText: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const lines = newText.split('\n').filter(line => line.trim() !== '');
      const newSubtasks = lines.map((line, index) => {
        const completed = line.startsWith('[x]');
        const title = line.replace(/^\[[ x]\]\s*/, '').trim();
        return {
          id: task.subtasks[index]?.id || `st-${Date.now()}-${Math.random()}`,
          title,
          completed 
        };
      });
      onUpdateTask({ ...task, subtasks: newSubtasks });
    }
  };

  const handleLinksTextChange = (taskId: string, newText: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const links = newText.split('\n').filter(line => line.trim() !== '');
      onUpdateTask({ ...task, referenceLinks: links });
    }
  };

  const tabs = [
    { id: 'tasks', name: 'TASKS', icon: 'fa-tasks', color: 'text-blue-600' },
    { id: 'users', name: 'TEAM', icon: 'fa-users', color: 'text-green-600' },
    { id: 'projects', name: 'PROJECTS', icon: 'fa-folder', color: 'text-purple-600' },
    { id: 'config', name: 'CONFIG', icon: 'fa-sliders', color: 'text-orange-600' },
    { id: 'settings', name: 'SETTINGS', icon: 'fa-cog', color: 'text-red-500' }
  ] as const;

  return (
    <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-200 overflow-hidden flex flex-col h-full animate-modalIn">
      <div className="flex items-center border-b border-gray-100 bg-gray-50/70 p-1.5 overflow-x-auto gap-1">
         {tabs.map(tab => (
           <button
             key={tab.id}
             onClick={() => handleTabClick(tab.id)}
             className={`flex items-center gap-2.5 px-6 py-3.5 text-[10px] font-black tracking-[0.15em] rounded-2xl transition-all relative ${activeTab === tab.id ? 'bg-white shadow-md ' + tab.color + ' ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
           >
             <i className={`fas ${tab.icon} text-[13px] ${activeTab === tab.id ? tab.color : 'text-gray-300'}`}></i>
             {tab.name}
             {tab.id === 'settings' && !sheetUrl && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
           </button>
         ))}
      </div>

      <div className="overflow-auto sheet-scroll flex-1 relative bg-white">
        {activeTab === 'tasks' && (
          <div className="min-w-full">
            <table className="min-w-full text-xs text-left text-gray-600 mb-12 border-collapse">
              <thead className="text-[10px] text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 font-black">
                <tr>
                  <th className="px-4 py-3 border-b border-r w-8">#</th>
                  <th className="px-4 py-3 border-b border-r min-w-[200px]">Task Name</th>
                  <th className="px-4 py-3 border-b border-r min-w-[250px]">Description</th>
                  <th className="px-4 py-3 border-b border-r min-w-[180px]">Subtasks ([ ] or [x])</th>
                  <th className="px-4 py-3 border-b border-r min-w-[180px]">Ref Links</th>
                  <th className="px-4 py-3 border-b border-r w-32">Status</th>
                  <th className="px-4 py-3 border-b border-r w-32">Priority</th>
                  <th className="px-4 py-3 border-b border-r w-32">Due Date</th>
                  <th className="px-4 py-3 border-b border-r w-40">Assignee</th>
                  <th className="px-4 py-3 border-b border-r w-24 text-center">Activity</th>
                  <th className="px-4 py-3 border-b w-10"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, index) => (
                  <tr key={task.id} className="bg-white border-b border-gray-100 hover:bg-blue-50/10 align-top group transition-colors">
                    <td className="px-4 py-3 border-r text-gray-400 font-mono">{index + 1}</td>
                    <td className="p-0 border-r"><textarea className="w-full px-4 py-3 bg-transparent h-full min-h-[60px] resize-none focus:bg-white focus:ring-0 focus:outline-none font-semibold text-gray-800" value={task.title} onChange={e => handleChange(task.id, 'title', e.target.value)} /></td>
                    <td className="p-0 border-r"><textarea className="w-full px-4 py-3 bg-transparent h-full min-h-[60px] resize-none focus:bg-white focus:ring-0 focus:outline-none text-gray-500" value={task.description || ''} onChange={e => handleChange(task.id, 'description', e.target.value)} /></td>
                    <td className="p-0 border-r"><textarea className="w-full px-4 py-3 bg-transparent h-full min-h-[60px] resize-none focus:bg-white focus:ring-0 focus:outline-none font-mono text-[10px] text-gray-400" value={(task.subtasks || []).map(s => `${s.completed ? '[x]' : '[ ]'} ${s.title}`).join('\n')} onChange={e => handleSubtaskTextChange(task.id, e.target.value)} /></td>
                    <td className="p-0 border-r"><textarea className="w-full px-4 py-3 bg-transparent h-full min-h-[60px] resize-none focus:bg-white focus:ring-0 focus:outline-none font-mono text-[10px] text-blue-500" value={(task.referenceLinks || []).join('\n')} onChange={e => handleLinksTextChange(task.id, e.target.value)} /></td>
                    <td className="p-0 border-r">
                      <select value={task.statusId} onChange={e => handleChange(task.id, 'statusId', e.target.value)} className="w-full h-full p-3 bg-transparent cursor-pointer font-bold text-gray-600 focus:outline-none">
                        {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="p-0 border-r">
                      <select value={task.priorityId} onChange={e => handleChange(task.id, 'priorityId', e.target.value)} className="w-full h-full p-3 bg-transparent cursor-pointer font-bold text-gray-600 focus:outline-none">
                        {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="p-0 border-r"><input type="date" value={task.dueDate} onChange={e => handleChange(task.id, 'dueDate', e.target.value)} className="w-full h-full p-3 bg-transparent focus:outline-none text-gray-600" /></td>
                    <td className="p-0 border-r">
                      <select value={task.assigneeId} onChange={e => handleChange(task.id, 'assigneeId', e.target.value)} className="w-full h-full p-3 bg-transparent font-bold text-gray-600 focus:outline-none">
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 border-r text-center font-bold text-green-600 flex items-center justify-center min-h-[60px]">
                        <span className="bg-green-50 px-2 py-1 rounded-lg border border-green-100">{task.comments?.length || 0}</span>
                    </td>
                    <td className="px-2 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => onDeleteTask(task.id)} className="text-red-300 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"><i className="fas fa-trash-alt"></i></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={onAddTask} className="fixed bottom-10 right-10 bg-green-600 text-white px-8 py-4 rounded-3xl shadow-2xl hover:bg-green-700 transition-all font-black text-xs uppercase tracking-widest flex items-center gap-3 z-20 active:scale-95"><i className="fas fa-plus"></i> NEW TASK</button>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="p-12 space-y-16 animate-modalIn">
            <div className="max-w-4xl">
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-8 flex items-center gap-3">
                <i className="fas fa-layer-group text-blue-500"></i> Workflow Statuses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statuses.map(s => (
                  <div key={s.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-3 hover:border-blue-200 transition-all">
                    <input value={s.name} onChange={e => onUpdateStatus({...s, name: e.target.value})} className="bg-transparent font-bold text-gray-800 w-full focus:outline-none text-sm" />
                    <button onClick={() => onDeleteStatus(s.id)} className="text-gray-200 hover:text-red-500 transition-colors"><i className="fas fa-times-circle"></i></button>
                  </div>
                ))}
                <button onClick={onAddStatus} className="border-2 border-dashed border-gray-200 p-5 rounded-3xl text-gray-400 hover:text-blue-500 hover:border-blue-200 transition-all font-bold text-xs uppercase tracking-widest">+ Status</button>
              </div>
            </div>
            
            <div className="max-w-4xl">
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-8 flex items-center gap-3">
                <i className="fas fa-flag text-orange-500"></i> Task Priorities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {priorities.map(p => (
                  <div key={p.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 hover:border-orange-200 transition-all">
                    <div className="flex items-center justify-between">
                      <input value={p.name} onChange={e => onUpdatePriority({...p, name: e.target.value})} className="bg-transparent font-bold text-gray-800 w-full focus:outline-none text-sm" />
                      <button onClick={() => onDeletePriority(p.id)} className="text-gray-200 hover:text-red-500"><i className="fas fa-times-circle"></i></button>
                    </div>
                    <select value={p.color} onChange={e => onUpdatePriority({...p, color: e.target.value})} className="text-[10px] w-full p-2 rounded-xl bg-gray-50 border border-gray-100 font-black uppercase tracking-widest text-gray-500">
                       <option value="bg-gray-100 text-gray-700 border-gray-200">Gray</option>
                       <option value="bg-blue-100 text-blue-700 border-blue-200">Blue</option>
                       <option value="bg-orange-100 text-orange-700 border-orange-200">Orange</option>
                       <option value="bg-red-100 text-red-700 border-red-200">Red</option>
                    </select>
                  </div>
                ))}
                <button onClick={onAddPriority} className="border-2 border-dashed border-gray-200 p-6 rounded-3xl text-gray-400 hover:text-orange-500 hover:border-orange-200 transition-all font-bold text-xs uppercase tracking-widest">+ Priority</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="p-12 animate-modalIn">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400">Team Roster</h3>
              <button onClick={onAddUser} className="bg-blue-50 text-blue-600 font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition-all shadow-sm">+ Member</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {users.map(u => (
                <div key={u.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center text-center gap-4 group hover:border-blue-200 transition-all">
                  <div className="relative">
                    <img src={u.avatar} alt={u.name} className="w-20 h-20 rounded-full border-4 border-white shadow-xl ring-1 ring-gray-100" />
                    <button onClick={() => onDeleteUser(u.id)} className="absolute -top-1 -right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><i className="fas fa-times"></i></button>
                  </div>
                  <div className="w-full">
                    <input value={u.name} onChange={e => onUpdateUser({...u, name: e.target.value})} className="w-full font-black text-gray-800 text-sm bg-transparent border-none text-center focus:ring-0 p-0" />
                    <input value={u.email} onChange={e => onUpdateUser({...u, email: e.target.value})} className="w-full text-xs text-gray-400 bg-transparent border-none text-center focus:ring-0 p-0 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="p-12 animate-modalIn">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400">Active Projects</h3>
              <button onClick={onAddProject} className="bg-purple-50 text-purple-600 font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest border border-purple-100 hover:bg-purple-100 transition-all shadow-sm">+ Project</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {projects.map(p => (
                <div key={p.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6 group hover:border-purple-200 transition-all">
                  <div className="flex items-center justify-between">
                    <input value={p.name} onChange={e => onUpdateProject({...p, name: e.target.value})} className="font-black text-gray-800 text-sm bg-transparent border-none focus:ring-0 p-0 w-full" />
                    <button onClick={() => onDeleteProject(p.id)} className="opacity-0 group-hover:opacity-100 text-gray-200 hover:text-red-500 transition-opacity p-1"><i className="fas fa-trash-alt text-xs"></i></button>
                  </div>
                  <select value={p.color} onChange={e => onUpdateProject({...p, color: e.target.value})} className="text-[10px] w-full p-3 rounded-2xl bg-gray-50 border border-gray-100 font-black uppercase tracking-widest text-gray-500">
                    <option value="bg-blue-100 text-blue-800">Blue Theme</option>
                    <option value="bg-green-100 text-green-800">Green Theme</option>
                    <option value="bg-purple-100 text-purple-800">Purple Theme</option>
                    <option value="bg-pink-100 text-pink-800">Pink Theme</option>
                    <option value="bg-yellow-100 text-yellow-800">Yellow Theme</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-12 max-w-3xl animate-modalIn">
            <div className="flex items-center gap-4 mb-10">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center text-3xl shadow-sm"><i className="fas fa-database"></i></div>
                <div>
                    <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Sync Settings</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Configure your external database</p>
                </div>
            </div>
            
            <div className="space-y-8">
              <div className="bg-gray-50 p-10 rounded-[3rem] border border-gray-200 shadow-inner">
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-4 tracking-widest">Google Apps Script Web App URL</label>
                <div className="flex flex-col gap-6">
                  <input 
                    type="text" 
                    value={tempUrl} 
                    onChange={e => setTempUrl(e.target.value)} 
                    placeholder="https://script.google.com/macros/s/AKfycby.../exec"
                    className="w-full p-5 bg-white border border-gray-200 rounded-[1.5rem] text-sm font-mono focus:ring-4 focus:ring-blue-100 focus:outline-none shadow-sm transition-all"
                  />
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
                       <div className={`w-3 h-3 rounded-full ${sheetUrl ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]'}`}></div>
                       <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em]">
                         {sheetUrl ? 'Live Connection' : 'Disconnected'}
                       </span>
                    </div>
                    <button 
                      onClick={() => onUpdateSheetUrl(tempUrl)} 
                      className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                    >
                      Save & Connect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SheetView;
