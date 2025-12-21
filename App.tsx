
import React, { useState, useEffect, useCallback } from 'react';
import { Task, User, Project, Priority, Status, GroupByOption } from './types';
import { MOCK_USERS, MOCK_PROJECTS, INITIAL_TASKS, DEFAULT_STATUSES, DEFAULT_PRIORITIES } from './constants';
import TaskCard from './components/TaskCard';
import SheetView from './components/SheetView';
import SetupGuide from './components/SetupGuide';

function App() {
  const [activeTab, setActiveTab] = useState<'board' | 'sheet' | 'setup'>('board');
  const [groupBy, setGroupBy] = useState<GroupByOption>('Status');
  
  // Data State
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [statuses, setStatuses] = useState<Status[]>(DEFAULT_STATUSES);
  const [priorities, setPriorities] = useState<Priority[]>(DEFAULT_PRIORITIES);
  
  // Filters
  const [filters, setFilters] = useState({
    project: 'all',
    assignee: 'all',
    status: 'all',
    priority: 'all',
    search: ''
  });
  
  // Sync State
  const [sheetUrl, setSheetUrl] = useState<string>(() => localStorage.getItem('teamSync_sheetUrl') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>('Never');

  // UI State
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Creation Modals State
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#DBEAFE'); // Default blue-ish
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');

  // --- SYNC ENGINE ---

  const mapSheetDataToApp = useCallback((data: any) => {
    // 1. Map Dictionaries
    const newStatuses = (data.status || []).map((r: any) => ({ id: r.Name, name: r.Name })); 
    const newPriorities = (data.priority || []).map((r: any) => ({ 
      id: r.Name, 
      name: r.Name, 
      color: r.ColorClass || 'bg-gray-100 text-gray-800' 
    }));
    const newProjects = (data.projects || []).map((r: any) => ({ 
      id: r.Name, 
      name: r.Name, 
      color: r.ColorHex ? `bg-[${r.ColorHex}]` : 'bg-gray-100' 
    }));
    const newUsers = (data.members || []).map((r: any) => ({ 
      id: r.Name, 
      name: r.Name, 
      email: r.Email,
      avatar: r.AvatarUrl 
    }));

    // Update Domain Lists
    if(newStatuses.length) setStatuses(newStatuses);
    if(newPriorities.length) setPriorities(newPriorities);
    if(newProjects.length) setProjects(newProjects);
    if(newUsers.length) setUsers(newUsers);

    // 2. Map Tasks
    if (data.tasks && Array.isArray(data.tasks)) {
      const mappedTasks: Task[] = data.tasks.map((t: any) => {
        return {
          id: t["ID"] ? String(t["ID"]) : `t${Date.now()}-${Math.random()}`,
          title: t["Title"] || 'Untitled',
          description: t["Description"] || '',
          statusId: t["Status"] || (newStatuses[0]?.id || 'To Do'),
          priorityId: t["Priority"] || (newPriorities[0]?.id || 'Low'),
          assigneeId: t["Assignee"] || '',
          projectId: t["Project"] || '',
          dueDate: t["DueDate"] ? new Date(t["DueDate"]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          referenceLinks: t["RefLinks"] ? String(t["RefLinks"]).split('\n').filter(Boolean) : [],
          activityTrail: t["ActivityTrail"] ? String(t["ActivityTrail"]).split('\n').filter(Boolean) : [],
          subtasks: t["Subtasks"] ? String(t["Subtasks"]).split('\n').filter(Boolean) : [],
          updatedAt: new Date().toISOString()
        };
      });
      setTasks(mappedTasks);
    }
  }, []);

  const fetchFromSheet = useCallback(async (url: string) => {
    if (!url || !url.startsWith('http')) return;
    setIsSyncing(true);
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (!response.ok) throw new Error("Sync Failed");
      const data = await response.json();
      mapSheetDataToApp(data);
      setLastSynced(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    } catch (e) {
      console.error("Sync Error:", e);
      alert("Could not sync. Check your Bridge URL.");
    } finally {
      setIsSyncing(false);
    }
  }, [mapSheetDataToApp]);

  useEffect(() => {
    localStorage.setItem('teamSync_sheetUrl', sheetUrl);
  }, [sheetUrl]);

  // Generic Sync function for any tab
  const pushReferenceDataToSheet = async (sheetName: string, idCol: string, data: any) => {
    if (!sheetUrl) return;
    setIsSyncing(true);
    try {
      const payload = {
        targetSheet: sheetName,
        action: "upsert",
        idColumn: idCol,
        data: data
      };
      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors', 
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' }
      });
      setLastSynced(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    } catch (e) {
      console.error("Push Error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const pushTaskToSheet = async (task: Task) => {
    await pushReferenceDataToSheet("Tasks", "ID", {
          "ID": task.id,
          "Title": task.title,
          "Description": task.description || '',
          "Status": task.statusId, 
          "Priority": task.priorityId, 
          "DueDate": task.dueDate,
          "Assignee": task.assigneeId,
          "Project": task.projectId,
          "RefLinks": (task.referenceLinks || []).join('\n'),
          "ActivityTrail": (task.activityTrail || []).join('\n'),
          "Subtasks": (task.subtasks || []).join('\n')
    });
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    if (selectedTask?.id === updatedTask.id) setSelectedTask(updatedTask);
    pushTaskToSheet(updatedTask);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setSelectedTask(null);
  };

  // --- ENTITY CREATION ---

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const newProject: Project = {
      id: newProjectName, // Using Name as ID for sheet sync simplicity
      name: newProjectName,
      color: `bg-[${newProjectColor}]` // storing class-like string or just hex? Sheet expects hex usually but apps script handles strings.
    };
    
    setProjects(prev => [...prev, newProject]);
    
    // Sync to "Projects" tab
    // Header: Name, ColorHex
    await pushReferenceDataToSheet("Projects", "Name", {
      "Name": newProject.name,
      "ColorHex": newProjectColor
    });

    setNewProjectName('');
    setIsAddProjectModalOpen(false);
  };

  const handleCreateMember = async () => {
    if (!newMemberName.trim()) return;
    const newMember: User = {
      id: newMemberName, // Using Name as ID
      name: newMemberName,
      email: newMemberEmail,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newMemberName)}&background=random`
    };

    setUsers(prev => [...prev, newMember]);

    // Sync to "Team Members" tab
    // Header: Name, Email, AvatarUrl
    await pushReferenceDataToSheet("Team Members", "Name", {
      "Name": newMember.name,
      "Email": newMember.email,
      "AvatarUrl": newMember.avatar
    });

    setNewMemberName('');
    setNewMemberEmail('');
    setIsAddMemberModalOpen(false);
  };

  // --- VIEW LOGIC ---

  const getColumns = () => {
    switch (groupBy) {
      case 'Status': return statuses.map(s => ({ id: s.id, title: s.name, type: 'status' }));
      case 'Priority': return priorities.map(p => ({ id: p.id, title: p.name, type: 'priority' }));
      case 'Assignee': return [...users.map(u => ({ id: u.id, title: u.name, type: 'assignee' })), { id: '', title: 'Unassigned', type: 'assignee' }];
      case 'Project': return [...projects.map(p => ({ id: p.id, title: p.name, type: 'project' })), { id: '', title: 'No Project', type: 'project' }];
      default: return [];
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesProject = filters.project === 'all' || t.projectId === filters.project;
    const matchesAssignee = filters.assignee === 'all' || t.assigneeId === filters.assignee;
    const matchesStatus = filters.status === 'all' || t.statusId === filters.status;
    const matchesPriority = filters.priority === 'all' || t.priorityId === filters.priority;
    const matchesSearch = !filters.search || t.title.toLowerCase().includes(filters.search.toLowerCase());
    return matchesProject && matchesAssignee && matchesStatus && matchesPriority && matchesSearch;
  });

  const handleDrop = (e: React.DragEvent, colId: string, type: string) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updates: Partial<Task> = {};
      if (type === 'status') updates.statusId = colId;
      if (type === 'priority') updates.priorityId = colId;
      if (type === 'assignee') updates.assigneeId = colId;
      if (type === 'project') updates.projectId = colId;
      handleUpdateTask({ ...task, ...updates });
    }
  };

  const handleAddTask = () => {
    const newTask: Task = {
      id: `t${Date.now()}`,
      title: 'New Task',
      description: '',
      statusId: statuses[0]?.id || 'To Do',
      priorityId: priorities[1]?.id || 'Medium',
      projectId: filters.project !== 'all' ? filters.project : (projects[0]?.id || ''),
      assigneeId: filters.assignee !== 'all' ? filters.assignee : '',
      dueDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
      subtasks: [],
      referenceLinks: [],
      activityTrail: []
    };
    setTasks(prev => [...prev, newTask]);
    setSelectedTask(newTask);
    pushTaskToSheet(newTask);
  };

  // --- RENDER ---

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-800 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white px-6 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-100">
             <i className="fas fa-check"></i>
           </div>
           <h1 className="font-bold text-lg tracking-tight">TeamSync</h1>
           
           <div className="h-6 w-px bg-gray-200 mx-2"></div>

           <nav className="flex bg-gray-100 rounded-lg p-1">
             {(['board', 'sheet', 'setup'] as const).map(tab => (
               <button 
                 key={tab} 
                 onClick={() => setActiveTab(tab)}
                 className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 {tab}
               </button>
             ))}
           </nav>
        </div>

        <div className="flex items-center gap-4">
           {sheetUrl ? (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100">
               <div className={`w-2 h-2 rounded-full bg-green-500 ${isSyncing ? 'animate-pulse' : ''}`}></div>
               <span className="text-[10px] font-bold uppercase tracking-wide">
                  {isSyncing ? 'Syncing...' : `Synced ${lastSynced}`}
               </span>
               <button onClick={() => fetchFromSheet(sheetUrl)} className="ml-2 hover:bg-green-100 rounded-full p-1 transition-colors">
                 <i className={`fas fa-sync-alt text-xs ${isSyncing ? 'fa-spin' : ''}`}></i>
               </button>
             </div>
           ) : (
             <button onClick={() => setActiveTab('setup')} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-full animate-pulse">
               <i className="fas fa-exclamation-circle mr-1"></i> Connect Sheet
             </button>
           )}
           <button onClick={handleAddTask} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100 transition-all flex items-center gap-2">
             <i className="fas fa-plus"></i> New Task
           </button>
        </div>
      </header>

      {/* Filter Bar */}
      {activeTab !== 'setup' && (
        <div className="bg-white px-6 py-3 border-b border-gray-100 flex items-center gap-4 overflow-x-auto shrink-0">
          <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-64 shrink-0">
            <i className="fas fa-search text-gray-400 text-xs mr-2"></i>
            <input 
              className="bg-transparent border-none outline-none text-xs font-medium w-full placeholder-gray-400" 
              placeholder="Search tasks..." 
              value={filters.search}
              onChange={e => setFilters({...filters, search: e.target.value})}
            />
          </div>
          <div className="h-6 w-px bg-gray-200"></div>
          
          <select 
            className="text-xs font-bold bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            value={filters.project} onChange={e => setFilters({...filters, project: e.target.value})}
          >
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select 
            className="text-xs font-bold bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            value={filters.assignee} onChange={e => setFilters({...filters, assignee: e.target.value})}
          >
            <option value="all">All Assignees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <div className="flex-1"></div>
          
          {/* Create Button Contextual to GroupBy */}
          {activeTab === 'board' && groupBy === 'Project' && (
             <button 
               onClick={() => setIsAddProjectModalOpen(true)}
               className="mr-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
             >
               <i className="fas fa-plus"></i> New Project
             </button>
          )}
          {activeTab === 'board' && groupBy === 'Assignee' && (
             <button 
               onClick={() => setIsAddMemberModalOpen(true)}
               className="mr-2 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
             >
               <i className="fas fa-plus"></i> New Member
             </button>
          )}

          {/* Group By Toggle */}
          {activeTab === 'board' && (
            <div className="flex items-center bg-gray-50 p-1 rounded-lg border border-gray-100">
               <span className="text-[10px] font-bold text-gray-400 uppercase px-2">Group By</span>
               {(['Status', 'Priority', 'Assignee', 'Project'] as const).map(opt => (
                 <button 
                   key={opt}
                   onClick={() => setGroupBy(opt)}
                   className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${groupBy === opt ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                   {opt}
                 </button>
               ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-6 relative">
         {activeTab === 'setup' && <SetupGuide />}
         
         {activeTab === 'sheet' && (
           <SheetView 
              tasks={filteredTasks} 
              users={users} 
              projects={projects} 
              statuses={statuses} 
              priorities={priorities}
              sheetUrl={sheetUrl} 
              onUpdateSheetUrl={setSheetUrl} 
              onRefresh={() => fetchFromSheet(sheetUrl)}
              onUpdateTask={handleUpdateTask}
              onSelectTask={setSelectedTask}
              onAddProject={() => setIsAddProjectModalOpen(true)}
              onAddMember={() => setIsAddMemberModalOpen(true)}
           />
         )}

         {activeTab === 'board' && (
           <div className="flex h-full gap-6 overflow-x-auto pb-4">
             {getColumns().map(col => {
               const colTasks = filteredTasks.filter(t => {
                  if (groupBy === 'Status') return t.statusId === col.id;
                  if (groupBy === 'Priority') return t.priorityId === col.id;
                  if (groupBy === 'Assignee') return t.assigneeId === col.id;
                  if (groupBy === 'Project') return t.projectId === col.id;
                  return false;
               });
               
               return (
                 <div 
                   key={col.id + col.type}
                   className="min-w-[300px] max-w-[300px] flex flex-col h-full rounded-2xl bg-gray-100/50 border border-transparent transition-colors"
                   onDragOver={e => { e.preventDefault(); setDraggedOverColumn(col.id); }}
                   onDragLeave={() => setDraggedOverColumn(null)}
                   onDrop={e => handleDrop(e, col.id, col.type)}
                   style={{ borderColor: draggedOverColumn === col.id ? '#3B82F6' : 'transparent' }}
                 >
                    <div className="p-4 flex justify-between items-center">
                       <h3 className="font-bold text-sm text-gray-700">{col.title}</h3>
                       <span className="bg-white px-2 py-0.5 rounded-md text-[10px] font-bold text-gray-400 shadow-sm border border-gray-100">
                         {colTasks.length}
                       </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                       {colTasks.map(task => (
                         <TaskCard 
                           key={task.id} 
                           task={task} 
                           assignee={users.find(u => u.id === task.assigneeId)}
                           project={projects.find(p => p.id === task.projectId)}
                           priority={priorities.find(p => p.id === task.priorityId)}
                           groupBy={groupBy}
                           onDragStart={(e, id) => { e.dataTransfer.setData('taskId', id); }}
                           onClick={setSelectedTask}
                         />
                       ))}
                    </div>
                 </div>
               );
             })}
           </div>
         )}
      </main>

      {/* Task Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedTask(null)}>
           <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                 <div className="flex-1 mr-8">
                    <input 
                      className="w-full bg-transparent text-2xl font-bold text-gray-800 outline-none placeholder-gray-300"
                      value={selectedTask.title}
                      onChange={e => handleUpdateTask({...selectedTask, title: e.target.value})}
                      placeholder="Task Title"
                    />
                 </div>
                 <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                   <i className="fas fa-times text-xl"></i>
                 </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                 {/* Left: Main Details */}
                 <div className="flex-1 p-8 overflow-y-auto space-y-8 custom-scrollbar">
                    {/* Description */}
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Description</h4>
                      <textarea 
                        className="w-full min-h-[100px] text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-50 transition-all resize-none"
                        placeholder="Add details..."
                        value={selectedTask.description}
                        onChange={e => handleUpdateTask({...selectedTask, description: e.target.value})}
                      />
                    </div>

                    {/* Subtasks */}
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Subtasks</h4>
                      <div className="space-y-2">
                        {(selectedTask.subtasks || []).map((st, i) => (
                           <div key={i} className="flex items-center gap-3 group">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                              <input 
                                className="flex-1 bg-transparent text-sm border-b border-transparent focus:border-gray-200 outline-none py-1"
                                value={st}
                                onChange={e => {
                                   const newSub = [...(selectedTask.subtasks || [])];
                                   newSub[i] = e.target.value;
                                   handleUpdateTask({...selectedTask, subtasks: newSub});
                                }}
                              />
                              <button onClick={() => {
                                const newSub = selectedTask.subtasks?.filter((_, idx) => idx !== i);
                                handleUpdateTask({...selectedTask, subtasks: newSub});
                              }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                                <i className="fas fa-times"></i>
                              </button>
                           </div>
                        ))}
                        <div className="flex items-center gap-2 mt-2">
                           <i className="fas fa-plus text-gray-400 text-xs"></i>
                           <input 
                             className="bg-transparent text-sm outline-none placeholder-gray-400"
                             placeholder="Add subtask..."
                             onKeyDown={e => {
                               if (e.key === 'Enter') {
                                 const val = e.currentTarget.value;
                                 if (val.trim()) {
                                   handleUpdateTask({...selectedTask, subtasks: [...(selectedTask.subtasks || []), val]});
                                   e.currentTarget.value = '';
                                 }
                               }
                             }}
                           />
                        </div>
                      </div>
                    </div>

                    {/* Reference Links */}
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Reference Links</h4>
                      <div className="space-y-2">
                        {(selectedTask.referenceLinks || []).map((link, i) => (
                           <div key={i} className="flex items-center gap-3 group">
                              <i className="fas fa-link text-gray-300 text-xs"></i>
                              <input 
                                className="flex-1 bg-transparent text-sm border-b border-transparent focus:border-gray-200 outline-none py-1 text-blue-600"
                                value={link}
                                onChange={e => {
                                   const newLinks = [...(selectedTask.referenceLinks || [])];
                                   newLinks[i] = e.target.value;
                                   handleUpdateTask({...selectedTask, referenceLinks: newLinks});
                                }}
                              />
                              <button onClick={() => {
                                const newLinks = selectedTask.referenceLinks?.filter((_, idx) => idx !== i);
                                handleUpdateTask({...selectedTask, referenceLinks: newLinks});
                              }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                                <i className="fas fa-times"></i>
                              </button>
                           </div>
                        ))}
                        <div className="flex items-center gap-2 mt-2">
                           <i className="fas fa-plus text-gray-400 text-xs"></i>
                           <input 
                             className="bg-transparent text-sm outline-none placeholder-gray-400"
                             placeholder="Add link..."
                             onKeyDown={e => {
                               if (e.key === 'Enter') {
                                 const val = e.currentTarget.value;
                                 if (val.trim()) {
                                   handleUpdateTask({...selectedTask, referenceLinks: [...(selectedTask.referenceLinks || []), val]});
                                   e.currentTarget.value = '';
                                 }
                               }
                             }}
                           />
                        </div>
                      </div>
                    </div>

                    {/* Activity Trail (Simple Log) */}
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Activity Log</h4>
                      <div className="space-y-3 pl-4 border-l-2 border-gray-100">
                         {(selectedTask.activityTrail || []).length === 0 && <p className="text-xs text-gray-300 italic">No activity yet.</p>}
                         {[...(selectedTask.activityTrail || [])].reverse().map((log, i) => (
                           <div key={i} className="text-xs text-gray-600">
                             {log}
                           </div>
                         ))}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <input 
                          className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-50"
                          placeholder="Add a comment..."
                          onKeyDown={e => {
                             if(e.key === 'Enter') {
                               const val = e.currentTarget.value;
                               if(val.trim()) {
                                 const newLog = `${new Date().toLocaleDateString()} - ${val}`; // Simple timestamp
                                 handleUpdateTask({...selectedTask, activityTrail: [...(selectedTask.activityTrail || []), newLog]});
                                 e.currentTarget.value = '';
                               }
                             }
                          }}
                        />
                      </div>
                    </div>
                 </div>

                 {/* Right: Metadata */}
                 <div className="w-80 bg-gray-50 border-l border-gray-200 p-6 space-y-6 overflow-y-auto">
                    <div>
                       <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-2">Status</label>
                       <select 
                         className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
                         value={selectedTask.statusId}
                         onChange={e => handleUpdateTask({...selectedTask, statusId: e.target.value})}
                       >
                         {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>

                    <div>
                       <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-2">Priority</label>
                       <select 
                         className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
                         value={selectedTask.priorityId}
                         onChange={e => handleUpdateTask({...selectedTask, priorityId: e.target.value})}
                       >
                         {priorities.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>

                    <div>
                       <div className="flex justify-between items-center mb-2">
                         <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Project</label>
                         <button onClick={() => setIsAddProjectModalOpen(true)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">
                           + Add New
                         </button>
                       </div>
                       <select 
                         className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
                         value={selectedTask.projectId}
                         onChange={e => handleUpdateTask({...selectedTask, projectId: e.target.value})}
                       >
                         {projects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>

                    <div>
                       <div className="flex justify-between items-center mb-2">
                         <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Assignee</label>
                         <button onClick={() => setIsAddMemberModalOpen(true)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">
                           + Add New
                         </button>
                       </div>
                       <select 
                         className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
                         value={selectedTask.assigneeId}
                         onChange={e => handleUpdateTask({...selectedTask, assigneeId: e.target.value})}
                       >
                         <option value="">Unassigned</option>
                         {users.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>

                    <div>
                       <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-2">Due Date</label>
                       <input 
                         type="date"
                         className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
                         value={selectedTask.dueDate}
                         onChange={e => handleUpdateTask({...selectedTask, dueDate: e.target.value})}
                       />
                    </div>

                    <div className="pt-6 mt-6 border-t border-gray-200">
                       <button 
                         onClick={() => handleDeleteTask(selectedTask.id)}
                         className="w-full py-3 rounded-xl border border-red-100 text-red-500 bg-red-50 text-xs font-bold uppercase tracking-wider hover:bg-red-100 transition-colors"
                       >
                         Delete Task
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Add Project Modal */}
      {isAddProjectModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
             <h3 className="font-bold text-lg text-gray-800">Add New Project</h3>
             <input 
               className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
               placeholder="Project Name"
               value={newProjectName}
               onChange={e => setNewProjectName(e.target.value)}
             />
             <div className="flex items-center gap-2">
               <label className="text-sm text-gray-500">Color:</label>
               <input 
                 type="color" 
                 value={newProjectColor} 
                 onChange={e => setNewProjectColor(e.target.value)}
                 className="h-8 w-8 rounded cursor-pointer border-none"
               />
             </div>
             <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsAddProjectModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleCreateProject} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Create</button>
             </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
             <h3 className="font-bold text-lg text-gray-800">Add New Member</h3>
             <input 
               className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
               placeholder="Full Name"
               value={newMemberName}
               onChange={e => setNewMemberName(e.target.value)}
             />
             <input 
               className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
               placeholder="Email Address"
               value={newMemberEmail}
               onChange={e => setNewMemberEmail(e.target.value)}
             />
             <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsAddMemberModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleCreateMember} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">Add Member</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
