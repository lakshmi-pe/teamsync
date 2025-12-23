
import React, { useState, useEffect, useCallback } from 'react';
import { Task, User, Project, Priority, Status, GroupByOption, ReferenceLink } from './types';
import { MOCK_USERS, MOCK_PROJECTS, INITIAL_TASKS, DEFAULT_STATUSES, DEFAULT_PRIORITIES, DEFAULT_SHEET_URL } from './constants';
import TaskCard from './components/TaskCard';
import SheetView from './components/SheetView';
import SetupGuide from './components/SetupGuide';
import EisenhowerMatrix from './components/EisenhowerMatrix';

function App() {
  const [activeTab, setActiveTab] = useState<'board' | 'sheet' | 'matrix' | 'setup'>('board');
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
  
  // Sync State - Using Hardcoded Default
  const [sheetUrl, setSheetUrl] = useState<string>(() => localStorage.getItem('teamSync_sheetUrl') || DEFAULT_SHEET_URL);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>('Never');

  // UI State
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Management Modals State
  const [manageModalType, setManageModalType] = useState<'project' | 'member' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemExtra, setNewItemExtra] = useState(''); // Color for project, Email for member
  const [newItemDescription, setNewItemDescription] = useState(''); // Description for project

  // Project Summary State
  const [summaryProjectId, setSummaryProjectId] = useState<string | null>(null);

  // --- SYNC ENGINE ---

  const mapSheetDataToApp = useCallback((data: any) => {
    // 1. Map Explicit Lists
    const newStatuses = (data.status || []).map((r: any) => ({ id: r.Name, name: r.Name })); 
    const newPriorities = (data.priority || []).map((r: any) => ({ 
      id: r.Name, 
      name: r.Name, 
      color: r.ColorClass || 'bg-gray-100 text-gray-800' 
    }));
    let newProjects = (data.projects || []).map((r: any) => ({ 
      id: r.Name, 
      name: r.Name, 
      color: r.ColorHex ? `bg-[${r.ColorHex}]` : 'bg-gray-100',
      description: r.Description || ''
    }));
    let newUsers = (data.members || []).map((r: any) => ({ 
      id: r.Name, 
      name: r.Name, 
      email: r.Email,
      avatar: r.AvatarUrl 
    }));

    // 2. Map Tasks
    const mappedTasks: Task[] = [];
    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks.forEach((t: any) => {
         // Parse RefLinks "Title|URL"
         const rawLinks = t["RefLinks"] ? String(t["RefLinks"]).split('\n').filter(Boolean) : [];
         const parsedLinks: ReferenceLink[] = rawLinks.map((l: string) => {
           const parts = l.split('|');
           // Handle legacy format (just url) or new format (title|url)
           if (parts.length >= 2) {
             return { title: parts[0].trim(), url: parts.slice(1).join('|').trim() };
           }
           return { title: 'Link', url: l.trim() };
         });

         mappedTasks.push({
          id: t["ID"] ? String(t["ID"]) : `t${Date.now()}-${Math.random()}`,
          title: t["Title"] || 'Untitled',
          description: t["Description"] || '',
          statusId: t["Status"] || (newStatuses[0]?.id || 'To Do'),
          priorityId: t["Priority"] || (newPriorities[0]?.id || 'Low'),
          assigneeId: t["Assignee"] || '',
          projectId: t["Project"] || '',
          dueDate: t["DueDate"] ? new Date(t["DueDate"]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          referenceLinks: parsedLinks,
          activityTrail: t["ActivityTrail"] ? String(t["ActivityTrail"]).split('\n').filter(Boolean) : [],
          subtasks: t["Subtasks"] ? String(t["Subtasks"]).split('\n').filter(Boolean) : [],
          updatedAt: new Date().toISOString()
        });
      });
      setTasks(mappedTasks);
    }

    // 3. Auto-Discovery
    const projectMap = new Map(newProjects.map((p: Project) => [p.name, p]));
    const userMap = new Map(newUsers.map((u: User) => [u.name, u]));
    
    mappedTasks.forEach(t => {
       if (t.projectId && !projectMap.has(t.projectId)) {
          const autoProject = { id: t.projectId, name: t.projectId, color: 'bg-gray-100', description: '' };
          newProjects.push(autoProject);
          projectMap.set(t.projectId, autoProject);
       }
       if (t.assigneeId && !userMap.has(t.assigneeId)) {
          const autoUser = { 
            id: t.assigneeId, 
            name: t.assigneeId, 
            email: '', 
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(t.assigneeId)}&background=random` 
          };
          newUsers.push(autoUser);
          userMap.set(t.assigneeId, autoUser);
       }
    });

    if(newStatuses.length) setStatuses(newStatuses);
    if(newPriorities.length) setPriorities(newPriorities);
    setProjects(newProjects);
    setUsers(newUsers);

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

  // Initial Sync if URL is present (it is hardcoded now)
  useEffect(() => {
      if(sheetUrl && lastSynced === 'Never') {
          fetchFromSheet(sheetUrl);
      }
  }, []); // Run once on mount

  const syncReferenceData = async (sheetName: string, action: 'upsert' | 'delete', idCol: string, data: any) => {
    if (!sheetUrl) return;
    setIsSyncing(true);
    try {
      const payload = {
        targetSheet: sheetName,
        action: action,
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
      console.error("Sync Error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const pushTaskToSheet = async (task: Task) => {
    const linksStr = (task.referenceLinks || []).map(l => `${l.title}|${l.url}`).join('\n');
    await syncReferenceData("Tasks", "upsert", "ID", {
          "ID": task.id,
          "Title": task.title,
          "Description": task.description || '',
          "Status": task.statusId, 
          "Priority": task.priorityId, 
          "DueDate": task.dueDate,
          "Assignee": task.assigneeId,
          "Project": task.projectId,
          "RefLinks": linksStr,
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
    syncReferenceData("Tasks", "delete", "ID", { id: id });
  };

  // --- ENTITY MANAGEMENT ---

  const handleAddProject = async () => {
    if (!newItemName.trim()) return;
    const color = newItemExtra || '#DBEAFE';
    const newProject: Project = { 
      id: newItemName, 
      name: newItemName, 
      color: `bg-[${color}]`,
      description: newItemDescription 
    };
    setProjects(prev => [...prev, newProject]);
    await syncReferenceData("Projects", "upsert", "Name", { 
      "Name": newProject.name, 
      "ColorHex": color,
      "Description": newProject.description 
    });
    setNewItemName('');
    setNewItemDescription('');
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm(`Delete project "${id}"? Tasks will be unassigned.`)) return;
    setProjects(prev => prev.filter(p => p.id !== id));
    const affectedTasks = tasks.filter(t => t.projectId === id);
    affectedTasks.forEach(t => handleUpdateTask({ ...t, projectId: '' }));
    await syncReferenceData("Projects", "delete", "Name", { id: id });
  };

  const handleAddMember = async () => {
    if (!newItemName.trim()) return;
    const newMember: User = {
      id: newItemName,
      name: newItemName,
      email: newItemExtra,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newItemName)}&background=random`
    };
    setUsers(prev => [...prev, newMember]);
    await syncReferenceData("Team Members", "upsert", "Name", {
      "Name": newMember.name, "Email": newMember.email, "AvatarUrl": newMember.avatar
    });
    setNewItemName('');
    setNewItemExtra('');
  };

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm(`Delete member "${id}"? Tasks will be unassigned.`)) return;
    setUsers(prev => prev.filter(u => u.id !== id));
    const affectedTasks = tasks.filter(t => t.assigneeId === id);
    affectedTasks.forEach(t => handleUpdateTask({ ...t, assigneeId: '' }));
    await syncReferenceData("Team Members", "delete", "Name", { id: id });
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
  }).sort((a, b) => {
    const isADone = statuses.find(s => s.id === a.statusId)?.name === 'Done' || a.statusId === 's4';
    const isBDone = statuses.find(s => s.id === b.statusId)?.name === 'Done' || b.statusId === 's4';
    if (isADone && !isBDone) return 1;
    if (!isADone && isBDone) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
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
             {(['board', 'sheet', 'matrix', 'setup'] as const).map(tab => (
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

      {/* Filter Bar (Hide in Setup) */}
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
               onClick={() => { setManageModalType('project'); setNewItemName(''); setNewItemExtra(''); setNewItemDescription(''); }}
               className="mr-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
             >
               <i className="fas fa-cog"></i> Manage Projects
             </button>
          )}
          {activeTab === 'board' && groupBy === 'Assignee' && (
             <button 
               onClick={() => { setManageModalType('member'); setNewItemName(''); setNewItemExtra(''); }}
               className="mr-2 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
             >
               <i className="fas fa-users-cog"></i> Manage Members
             </button>
          )}

          {/* Group By Toggle (Only for Board) */}
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
         
         {activeTab === 'matrix' && (
           <EisenhowerMatrix 
             tasks={filteredTasks} 
             priorities={priorities} 
             statuses={statuses} 
             onSelectTask={setSelectedTask} 
           />
         )}

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
              onManageProjects={() => { setManageModalType('project'); setNewItemName(''); setNewItemExtra(''); }}
              onManageMembers={() => { setManageModalType('member'); setNewItemName(''); setNewItemExtra(''); }}
           />
         )}

         {activeTab === 'board' && (
           <div className="flex h-full gap-6 overflow-x-auto pb-4">
             {getColumns().map(col => {
               // Find project description if grouping by Project
               const colProject = groupBy === 'Project' ? projects.find(p => p.id === col.id) : null;

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
                    <div className="p-4 group/header relative">
                       <div className="flex justify-between items-center mb-1">
                          <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                            {col.title}
                            {/* Delete button in column header if applicable */}
                            {col.id && (col.type === 'project' || col.type === 'assignee') && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  col.type === 'project' ? handleDeleteProject(col.id) : handleDeleteMember(col.id);
                                }}
                                className="opacity-0 group-hover/header:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs"
                                title="Delete this column"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            )}
                          </h3>
                          <div className="flex items-center gap-2">
                            {/* Summary Generator Button for Projects */}
                            {col.id && col.type === 'project' && (
                                <button 
                                  onClick={() => setSummaryProjectId(col.id)}
                                  className="text-[10px] font-bold text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded opacity-0 group-hover/header:opacity-100 transition-opacity"
                                  title="Generate Reference Summary"
                                >
                                  <i className="fas fa-list-alt"></i> Summary
                                </button>
                            )}
                            <span className="bg-white px-2 py-0.5 rounded-md text-[10px] font-bold text-gray-400 shadow-sm border border-gray-100">
                              {colTasks.length}
                            </span>
                          </div>
                       </div>
                       
                       {/* Project Description Display */}
                       {colProject && colProject.description && (
                         <div className="text-[10px] text-gray-500 leading-tight mt-1 line-clamp-3 bg-white/50 p-2 rounded-lg border border-gray-100 italic">
                           {colProject.description}
                         </div>
                       )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                       {colTasks.map(task => (
                         <TaskCard 
                           key={task.id} 
                           task={task} 
                           assignee={users.find(u => u.id === task.assigneeId)}
                           project={projects.find(p => p.id === task.projectId)}
                           priority={priorities.find(p => p.id === task.priorityId)}
                           status={statuses.find(s => s.id === task.statusId)}
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

                    {/* Reference Links (New Format) */}
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Reference Links</h4>
                      <div className="space-y-3">
                        {(selectedTask.referenceLinks || []).map((link, i) => (
                           <div key={i} className="flex gap-2 group items-start">
                              <div className="pt-2">
                                <i className="fas fa-link text-gray-300 text-xs"></i>
                              </div>
                              <div className="flex-1 space-y-1">
                                <input 
                                  className="w-full bg-transparent text-xs font-bold border-b border-transparent focus:border-gray-200 outline-none text-gray-700"
                                  placeholder="Link Title"
                                  value={link.title}
                                  onChange={e => {
                                     const newLinks = [...(selectedTask.referenceLinks || [])];
                                     newLinks[i] = { ...newLinks[i], title: e.target.value };
                                     handleUpdateTask({...selectedTask, referenceLinks: newLinks});
                                  }}
                                />
                                <input 
                                  className="w-full bg-transparent text-xs border-b border-transparent focus:border-gray-200 outline-none text-blue-500"
                                  placeholder="URL"
                                  value={link.url}
                                  onChange={e => {
                                     const newLinks = [...(selectedTask.referenceLinks || [])];
                                     newLinks[i] = { ...newLinks[i], url: e.target.value };
                                     handleUpdateTask({...selectedTask, referenceLinks: newLinks});
                                  }}
                                />
                              </div>
                              <button onClick={() => {
                                const newLinks = selectedTask.referenceLinks?.filter((_, idx) => idx !== i);
                                handleUpdateTask({...selectedTask, referenceLinks: newLinks});
                              }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 pt-1">
                                <i className="fas fa-times"></i>
                              </button>
                           </div>
                        ))}
                        <button 
                          onClick={() => {
                             handleUpdateTask({...selectedTask, referenceLinks: [...(selectedTask.referenceLinks || []), { title: 'New Link', url: '' }]});
                          }}
                          className="flex items-center gap-2 mt-2 text-xs font-bold text-blue-500 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg w-fit transition-colors"
                        >
                           <i className="fas fa-plus"></i> Add Link
                        </button>
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
                         <button onClick={() => { setManageModalType('project'); setNewItemName(''); setNewItemExtra(''); setNewItemDescription(''); }} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">
                           Manage
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
                         <button onClick={() => { setManageModalType('member'); setNewItemName(''); setNewItemExtra(''); }} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">
                           Manage
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

      {/* Project Reference Summary Modal */}
      {summaryProjectId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={() => setSummaryProjectId(null)}>
             <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">Project Reference Summary</h3>
                        <p className="text-xs text-gray-500">{projects.find(p => p.id === summaryProjectId)?.name}</p>
                    </div>
                    <button onClick={() => setSummaryProjectId(null)} className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="p-3 text-xs font-bold text-gray-500 border-b">Task</th>
                                <th className="p-3 text-xs font-bold text-gray-500 border-b">Link Title</th>
                                <th className="p-3 text-xs font-bold text-gray-500 border-b">URL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tasks
                                .filter(t => t.projectId === summaryProjectId)
                                .flatMap(t => (t.referenceLinks || []).map(link => ({ task: t.title, ...link })))
                                .map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="p-3 text-sm text-gray-800 font-medium">{item.task}</td>
                                        <td className="p-3 text-sm text-gray-600">{item.title}</td>
                                        <td className="p-3 text-sm text-blue-500 truncate max-w-[200px]">
                                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                {item.url}
                                            </a>
                                        </td>
                                    </tr>
                            ))}
                            {tasks.filter(t => t.projectId === summaryProjectId).every(t => !t.referenceLinks?.length) && (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-gray-400 text-sm">No reference links found in this project.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button onClick={() => setSummaryProjectId(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-300">
                        Close
                    </button>
                </div>
             </div>
          </div>
      )}

      {/* Unified Manage Modal */}
      {manageModalType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6 max-h-[80vh] flex flex-col">
             <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">
                  Manage {manageModalType === 'project' ? 'Projects' : 'Members'}
                </h3>
                <button onClick={() => setManageModalType(null)} className="text-gray-400 hover:text-gray-600">
                  <i className="fas fa-times"></i>
                </button>
             </div>

             {/* List */}
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {(manageModalType === 'project' ? projects : users).map((item) => (
                   <div key={item.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg group">
                      <div className="flex items-center gap-3">
                         {manageModalType === 'member' && (
                           <img src={(item as User).avatar} className="w-8 h-8 rounded-full bg-gray-200" alt=""/>
                         )}
                         <div>
                           <div className="font-medium text-sm text-gray-700">{item.name}</div>
                           {manageModalType === 'project' && (item as Project).description && (
                             <div className="text-[10px] text-gray-500 italic mt-0.5 line-clamp-1">{(item as Project).description}</div>
                           )}
                         </div>
                      </div>
                      <button 
                        onClick={() => manageModalType === 'project' ? handleDeleteProject(item.id) : handleDeleteMember(item.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                   </div>
                ))}
             </div>

             {/* Add New Section */}
             <div className="pt-4 border-t border-gray-100 space-y-3">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Add New</h4>
                 <input 
                   className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                   placeholder={manageModalType === 'project' ? "Project Name" : "Member Name"}
                   value={newItemName}
                   onChange={e => setNewItemName(e.target.value)}
                 />
                 {manageModalType === 'member' ? (
                   <input 
                     className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                     placeholder="Email Address"
                     value={newItemExtra}
                     onChange={e => setNewItemExtra(e.target.value)}
                   />
                 ) : (
                   <div className="space-y-3">
                     <textarea 
                       className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 min-h-[60px] resize-none"
                       placeholder="Project Description"
                       value={newItemDescription}
                       onChange={e => setNewItemDescription(e.target.value)}
                     />
                     <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Color:</span>
                        <input 
                          type="color" 
                          value={newItemExtra || '#DBEAFE'} 
                          onChange={e => setNewItemExtra(e.target.value)}
                          className="h-8 w-8 rounded cursor-pointer border-none"
                        />
                     </div>
                   </div>
                 )}
                 <button 
                   onClick={manageModalType === 'project' ? handleAddProject : handleAddMember}
                   className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black transition-colors"
                 >
                   Add {manageModalType === 'project' ? 'Project' : 'Member'}
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
