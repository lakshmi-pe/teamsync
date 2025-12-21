import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Task, User, Project, Priority, Status, Comment } from './types';
import { MOCK_USERS, MOCK_PROJECTS, INITIAL_TASKS, DEFAULT_STATUSES, DEFAULT_PRIORITIES } from './constants';
import TaskCard from './components/TaskCard';
import SheetView from './components/SheetView';
import { parseTaskWithGemini } from './services/geminiService';

type GroupBy = 'Status' | 'Priority' | 'Assignee' | 'Project';

function App() {
  const [viewMode, setViewMode] = useState<'board' | 'sheet'>('board');
  const [activeSheetTab, setActiveSheetTab] = useState<'tasks' | 'users' | 'projects' | 'config' | 'settings'>('tasks');
  const [groupBy, setGroupBy] = useState<GroupBy>('Status');
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [statuses, setStatuses] = useState<Status[]>(DEFAULT_STATUSES);
  const [priorities, setPriorities] = useState<Priority[]>(DEFAULT_PRIORITIES);
  
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  
  const [sheetUrl, setSheetUrl] = useState<string>(() => localStorage.getItem('teamSync_sheetUrl') || '');
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>('Never');
  const [quickAddInput, setQuickAddInput] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  // --- SYNC LOGIC ---

  const fetchFromSheet = useCallback(async (url: string) => {
    if (!url) return;
    setIsSyncing(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();

      // Process Config first so we have the IDs for mapping
      let currentStatuses = statuses;
      let currentPriorities = priorities;
      let currentUsers = users;
      let currentProjects = projects;

      if (data.config && data.config.length > 0) {
        currentStatuses = data.config
          .filter((c: any) => c["Status Options"])
          .map((c: any, i: number) => ({ id: `s${i+1}`, name: c["Status Options"] }));
        setStatuses(currentStatuses);

        currentPriorities = data.config
          .filter((c: any) => c["Priority Options"])
          .map((c: any, i: number) => ({ 
            id: `pr${i+1}`, 
            name: c["Priority Options"], 
            color: c["Priority Color Code"] || 'bg-gray-100 text-gray-700 border-gray-200' 
          }));
        setPriorities(currentPriorities);
      }

      if (data.members && data.members.length > 0) {
        currentUsers = data.members.map((m: any) => ({
          id: m["Internal ID"] || `u${Math.random()}`,
          name: m["Member Name"],
          email: m["Email Address"] || '',
          avatar: m["Avatar URL"] || `https://picsum.photos/seed/${m["Member Name"]}/40/40`
        }));
        setUsers(currentUsers);
      }

      if (data.projects && data.projects.length > 0) {
        currentProjects = data.projects.map((p: any) => ({
          id: p["Internal ID"] || `p${Math.random()}`,
          name: p["Project Name"],
          color: p["Color Theme"] || 'bg-blue-100 text-blue-800'
        }));
        setProjects(currentProjects);
      }

      if (data.tasks) {
        const mappedTasks: Task[] = data.tasks.map((t: any) => {
          // Resolve IDs using the variables we just calculated locally to avoid stale state
          const sId = currentStatuses.find(s => s.name === t["Status"])?.id || currentStatuses[0]?.id || 's1';
          const pId = currentPriorities.find(p => p.name === t["Priority"])?.id || currentPriorities[1]?.id || 'pr2';
          const uId = currentUsers.find(u => u.name === t["Assignee"])?.id || '';
          const projId = currentProjects.find(p => p.name === t["Project"])?.id || '';

          const comments: Comment[] = (t["Activity Log"] || "").split('\n').filter(Boolean).map((log: string, i: number) => {
            const match = log.match(/\[(.*?)\] (.*) \((.*)\)/);
            return {
              id: `c${i}-${Date.now()}`,
              authorId: currentUsers.find(u => u.name === match?.[1])?.id || 'u1',
              text: match?.[2] || log,
              createdAt: match?.[3] || new Date().toISOString()
            };
          });

          return {
            id: t["Task ID"] || `t${Date.now()}-${Math.random()}`,
            title: t["Title"] || 'Untitled Task',
            description: t["Description"] || '',
            statusId: sId,
            priorityId: pId,
            assigneeId: uId,
            projectId: projId,
            dueDate: t["Due Date"] ? new Date(t["Due Date"]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            referenceLinks: (t["Reference Links"] || "").split('\n').filter(Boolean),
            comments,
            subtasks: [],
            createdAt: new Date().toISOString()
          };
        });
        setTasks(mappedTasks);
      }
      setLastSynced(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Sync pull error:", e);
      alert("Error syncing from sheet. Check your URL and Apps Script deployment.");
    } finally {
      setIsSyncing(false);
    }
  }, []); // Remove dependencies to keep it stable

  // Handle URL changes and initial load
  useEffect(() => {
    localStorage.setItem('teamSync_sheetUrl', sheetUrl);
    if (sheetUrl && lastSynced === 'Never') {
      fetchFromSheet(sheetUrl);
    }
  }, [sheetUrl, fetchFromSheet, lastSynced]);

  const pushToSheet = async (task: Task) => {
    if (!sheetUrl) return;
    setIsSyncing(true);
    try {
      const assignee = users.find(u => u.id === task.assigneeId)?.name || '';
      const project = projects.find(p => p.id === task.projectId)?.name || '';
      const status = statuses.find(s => s.id === task.statusId)?.name || '';
      const priority = priorities.find(p => p.id === task.priorityId)?.name || '';

      const payload = {
        targetSheet: "Tasks",
        action: "upsert",
        idColumn: "Task ID",
        data: {
          "Task ID": task.id,
          "Title": task.title,
          "Description": task.description || '',
          "Status": status,
          "Priority": priority,
          "Due Date": task.dueDate,
          "Assignee": assignee,
          "Project": project,
          "Reference Links": (task.referenceLinks || []).join('\n'),
          "Activity Log": (task.comments || []).map(c => `[${users.find(u => u.id === c.authorId)?.name || 'User'}] ${c.text} (${c.createdAt})`).join('\n')
        }
      };

      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });
      setLastSynced(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Sync push error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- GET COLUMNS LOGIC ---
  const getColumns = useCallback(() => {
    switch (groupBy) {
      case 'Status':
        return statuses.map(s => ({ id: s.id, title: s.name, type: 'status' }));
      case 'Priority':
        return priorities.map(p => ({ id: p.id, title: p.name, type: 'priority' }));
      case 'Assignee': {
        const assigneeCols = users.map(u => ({ id: u.id, title: u.name, type: 'assignee' }));
        return [...assigneeCols, { id: 'unassigned', title: 'Unassigned', type: 'assignee' }];
      }
      case 'Project': {
        const projectCols = projects.map(p => ({ id: p.id, title: p.name, type: 'project' }));
        return [...projectCols, { id: 'no-project', title: 'No Project', type: 'project' }];
      }
      default:
        return [];
    }
  }, [groupBy, statuses, priorities, users, projects]);

  // --- HANDLERS ---

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    if (selectedTask?.id === updatedTask.id) setSelectedTask(updatedTask);
    pushToSheet(updatedTask);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDraggedOverColumn(columnId);
  };

  const handleDrop = (e: React.DragEvent, columnId: string, columnType: string) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
      const updatedTask = { ...task };
      switch (columnType) {
        case 'status': updatedTask.statusId = columnId; break;
        case 'priority': updatedTask.priorityId = columnId; break;
        case 'assignee': updatedTask.assigneeId = columnId === 'unassigned' ? '' : columnId; break;
        case 'project': updatedTask.projectId = columnId === 'no-project' ? '' : columnId; break;
      }
      handleUpdateTask(updatedTask);
    }
  };

  const handleAddTask = () => {
    const newTask: Task = {
      id: `t${Date.now()}`,
      title: 'New Task',
      description: '',
      referenceLinks: [],
      comments: [],
      statusId: statuses[0].id,
      priorityId: priorities[1].id,
      dueDate: new Date().toISOString().split('T')[0],
      assigneeId: filterAssignee !== 'all' ? filterAssignee : '',
      projectId: filterProject !== 'all' ? filterProject : '',
      subtasks: [],
      createdAt: new Date().toISOString()
    };
    setTasks(prev => [...prev, newTask]);
    pushToSheet(newTask);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAddComment = (taskId: string) => {
    if (!commentInput.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const newComment: Comment = {
        id: `c${Date.now()}`,
        text: commentInput,
        authorId: 'u1', 
        createdAt: new Date().toISOString()
      };
      handleUpdateTask({ ...task, comments: [...(task.comments || []), newComment] });
      setCommentInput('');
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddInput.trim()) return;
    const parsedData = await parseTaskWithGemini(quickAddInput);
    if (parsedData) {
      const newTask: Task = {
        id: `t${Date.now()}`,
        title: parsedData.title || quickAddInput,
        description: parsedData.description || '',
        referenceLinks: [],
        comments: [],
        statusId: statuses[0].id,
        priorityId: priorities[1].id,
        dueDate: parsedData.dueDate || new Date().toISOString().split('T')[0],
        assigneeId: filterAssignee !== 'all' ? filterAssignee : '',
        projectId: filterProject !== 'all' ? filterProject : '',
        subtasks: [],
        createdAt: new Date().toISOString()
      };
      setTasks(prev => [...prev, newTask]);
      setQuickAddInput('');
      pushToSheet(newTask);
    }
  };

  const downloadSampleExcel = () => {
    const wb = XLSX.utils.book_new();
    const tasksData = tasks.map(t => ({
        "Task ID": t.id,
        "Title": t.title,
        "Description": t.description || '',
        "Status": statuses.find(s => s.id === t.statusId)?.name || '',
        "Priority": priorities.find(p => p.id === t.priorityId)?.name || '',
        "Due Date": t.dueDate,
        "Assignee": users.find(u => u.id === t.assigneeId)?.name || '',
        "Project": projects.find(p => p.id === t.projectId)?.name || '',
        "Reference Links": (t.referenceLinks || []).join('\n'),
        "Activity Log": (t.comments || []).map(c => `[${users.find(u => u.id === c.authorId)?.name || 'User'}] ${c.text} (${c.createdAt})`).join('\n')
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tasksData), "Tasks");
    XLSX.writeFile(wb, "TeamSync_Master_Database.xlsx");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-100"><i className="fas fa-check"></i></div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">TeamSync</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{isSyncing ? 'Syncing...' : `Synced ${lastSynced}`}</span>
                {sheetUrl && (
                  <button onClick={() => fetchFromSheet(sheetUrl)} className={`text-[10px] text-blue-500 hover:text-blue-700 font-black uppercase tracking-widest flex items-center gap-1 transition-all ${isSyncing ? 'animate-pulse' : ''}`}>
                    <i className={`fas fa-sync-alt ${isSyncing ? 'fa-spin' : ''}`}></i> Refresh
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 max-w-xl w-full">
            <form onSubmit={handleQuickAdd} className="relative">
              <input value={quickAddInput} onChange={e => setQuickAddInput(e.target.value)} placeholder="Type a task title and press Enter..." className="w-full pl-10 pr-12 py-2.5 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm transition-all" />
              <i className="fas fa-plus-circle text-gray-300 absolute left-3.5 top-3.5 text-xs"></i>
            </form>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowGuide(true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border shadow-sm ${sheetUrl ? 'bg-green-50 text-green-600 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100 animate-pulse'}`}>
                <i className={`fas ${sheetUrl ? 'fa-link' : 'fa-plug'} text-[10px]`}></i>
                {sheetUrl ? 'Active Sync' : 'Setup Required'}
             </button>
             <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'board' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Board</button>
                <button onClick={() => setViewMode('sheet')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'sheet' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500'}`}>Sheet</button>
             </div>
          </div>
        </div>
      </header>

      {viewMode === 'board' && (
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap items-center gap-6 sticky top-[73px] z-30 shadow-sm">
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Columns</span>
             <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
               {(['Status', 'Priority', 'Assignee', 'Project'] as const).map(g => (
                 <button key={g} onClick={() => setGroupBy(g)} className={`text-[10px] px-3 py-1 rounded-md font-bold uppercase transition-all ${groupBy === g ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>{g}</button>
               ))}
             </div>
          </div>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Project</label>
                <select className="bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 px-3 py-1 focus:ring-2 focus:ring-blue-100 cursor-pointer" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                  <option value="all">All</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
             </div>
             <div className="flex items-center gap-3">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Team</label>
                <select className="bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 px-3 py-1 focus:ring-2 focus:ring-blue-100 cursor-pointer" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
                  <option value="all">All</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
             </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden p-6">
        {viewMode === 'sheet' ? (
          <SheetView 
            tasks={tasks} users={users} projects={projects} statuses={statuses} priorities={priorities} sheetUrl={sheetUrl}
            onUpdateSheetUrl={setSheetUrl} onUpdateTask={handleUpdateTask} onAddTask={handleAddTask} onDeleteTask={handleDeleteTask}
            onUpdateUser={u => setUsers(prev => prev.map(x => x.id === u.id ? u : x))} onAddUser={() => {}} onDeleteUser={() => {}}
            onUpdateProject={p => setProjects(prev => prev.map(x => x.id === p.id ? p : x))} onAddProject={() => {}} onDeleteProject={() => {}}
            onUpdateStatus={s => setStatuses(prev => prev.map(x => x.id === s.id ? s : x))} onAddStatus={() => {}} onDeleteStatus={() => {}}
            onUpdatePriority={p => setPriorities(prev => prev.map(x => x.id === p.id ? p : x))} onAddPriority={() => {}} onDeletePriority={() => {}}
          />
        ) : (
          <div className="flex h-full gap-6 overflow-x-auto pb-6">
            {getColumns().map(column => {
                const columnTasks = tasks.filter(t => {
                    const matchesColumn = (groupBy === 'Status' && t.statusId === column.id) ||
                                          (groupBy === 'Priority' && t.priorityId === column.id) ||
                                          (groupBy === 'Assignee' && (column.id === 'unassigned' ? !t.assigneeId : t.assigneeId === column.id)) ||
                                          (groupBy === 'Project' && (column.id === 'no-project' ? !t.projectId : t.projectId === column.id));
                    const matchesProject = filterProject === 'all' || t.projectId === filterProject;
                    const matchesAssignee = filterAssignee === 'all' || t.assigneeId === filterAssignee;
                    return matchesColumn && matchesProject && matchesAssignee;
                });
                const isOver = draggedOverColumn === column.id;
                return (
                    <div key={column.id} className={`min-w-[320px] max-w-[400px] flex flex-col h-full transition-all duration-200 ${isOver ? 'scale-[1.02]' : ''}`} onDragOver={e => handleDragOver(e, column.id)} onDragLeave={() => setDraggedOverColumn(null)} onDrop={e => handleDrop(e, column.id, column.type)}>
                        <div className="flex items-center justify-between mb-4 px-3">
                            <h3 className={`font-black uppercase text-xs tracking-tighter transition-colors ${isOver ? 'text-blue-600' : 'text-gray-500'}`}>{column.title}</h3>
                            <span className="text-[10px] font-black text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full shadow-sm">{columnTasks.length}</span>
                        </div>
                        <div className={`flex-1 rounded-[2.5rem] p-4 overflow-y-auto space-y-4 border border-gray-200/50 shadow-inner sheet-scroll transition-colors ${isOver ? 'bg-blue-50/50' : 'bg-gray-100/40'}`}>
                            {columnTasks.map(task => (
                                <TaskCard key={task.id} task={task} priority={priorities.find(p => p.id === task.priorityId)} assignee={users.find(u => u.id === task.assigneeId)} project={projects.find(p => p.id === task.projectId)} onDragStart={handleDragStart} onClick={setSelectedTask} />
                            ))}
                            <button onClick={handleAddTask} className="w-full py-6 border-2 border-dashed border-gray-200 rounded-[1.8rem] text-gray-400 hover:text-blue-500 hover:border-blue-200 transition-all font-black text-[10px] uppercase tracking-[0.2em] bg-white/50">+ New Task</button>
                        </div>
                    </div>
                );
            })}
          </div>
        )}
      </main>

      {showGuide && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-12 animate-modalIn border border-gray-100 overflow-y-auto max-h-[90vh] sheet-scroll">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center text-3xl"><i className="fas fa-satellite-dish"></i></div>
                 <div>
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Sync Gateway</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Connect your Google Sheet</p>
                 </div>
              </div>
              <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-gray-800 transition-colors p-3 bg-gray-50 rounded-full hover:bg-red-50 hover:text-red-500"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="bg-blue-50 p-8 rounded-[2rem] border border-blue-100 space-y-4 shadow-sm mb-8">
              <ol className="space-y-3 text-xs text-blue-900 font-medium list-decimal list-inside">
                <li>
                  Open your Google Sheet &gt; <strong>Extensions</strong> &gt;{" "}
                  <strong>Apps Script</strong>.
                </li>
                <li>
                  Delete any code there and <strong>Paste the Bridge Code</strong> (copy
                  below).
                </li>
                <li>
                  Click <strong>Deploy</strong> &gt; <strong>New Deployment</strong> &gt;
                  {" "}Type: <strong>Web App</strong>.
                </li>
                <li>
                  Set &quot;Who has access&quot; to <strong>Anyone</strong>.
                </li>
                <li>
                  Copy the <strong>Web App URL</strong> and paste it into the{" "}
                  <strong>Settings</strong> tab here.
                </li>
              </ol>
            </div>
            <button onClick={downloadSampleExcel} className="w-full py-4 bg-green-50 text-green-700 border border-green-200 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-green-100 transition-all"><i className="fas fa-file-excel"></i> Download Excel Template</button>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl p-8 animate-modalIn border border-gray-100 max-h-[90vh] overflow-y-auto sheet-scroll">
              <div className="flex justify-between items-start mb-6">
                 <div className="flex-1">
                   <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Task Title</label>
                   <input className="text-2xl font-black focus:outline-none w-full border-b-2 border-transparent focus:border-blue-500 pb-1 transition-all" value={selectedTask.title} onChange={e => handleUpdateTask({...selectedTask, title: e.target.value})} />
                 </div>
                 <button onClick={() => setSelectedTask(null)} className="ml-4 p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><i className="fas fa-times"></i></button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 space-y-8">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Description</label>
                        <textarea className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm min-h-[100px] focus:ring-2 focus:ring-blue-100" value={selectedTask.description || ''} onChange={e => handleUpdateTask({...selectedTask, description: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-4">Activity Trail</label>
                        <div className="space-y-4 mb-4 max-h-[200px] overflow-y-auto pr-2 sheet-scroll">
                            {(selectedTask.comments || []).map((comment) => (
                                <div key={comment.id} className="flex gap-3 items-start">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[8px] font-bold text-blue-600">
                                        {users.find(u => u.id === comment.authorId)?.name.charAt(0) || 'U'}
                                    </div>
                                    <div className="flex-1 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                                        <p className="text-xs text-gray-700">{comment.text}</p>
                                        <span className="text-[9px] text-gray-400 mt-1 block font-medium">{users.find(u => u.id === comment.authorId)?.name} • {new Date(comment.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="relative">
                            <input className="w-full pl-4 pr-12 py-3 bg-gray-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-blue-100" placeholder="Add update..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment(selectedTask.id)} />
                            <button onClick={() => handleAddComment(selectedTask.id)} className="absolute right-3 top-2.5 p-1 text-blue-600 hover:bg-blue-100 rounded-lg"><i className="fas fa-paper-plane text-xs"></i></button>
                        </div>
                    </div>
                 </div>
                 <div className="bg-gray-50 p-6 rounded-3xl space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Status</label>
                        <select className="w-full p-3 bg-white rounded-xl border-none shadow-sm text-sm font-bold" value={selectedTask.statusId} onChange={e => handleUpdateTask({...selectedTask, statusId: e.target.value})}>
                        {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Assignee</label>
                        <select className="w-full p-3 bg-white rounded-xl border-none shadow-sm text-sm font-bold" value={selectedTask.assigneeId} onChange={e => handleUpdateTask({...selectedTask, assigneeId: e.target.value})}>
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div className="pt-4 border-t border-gray-200">
                      <button onClick={() => { handleDeleteTask(selectedTask.id); setSelectedTask(null); }} className="w-full py-3 bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-200 transition-colors"><i className="fas fa-trash-alt mr-2"></i> Delete Task</button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;
