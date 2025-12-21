import React, { useState, useEffect } from 'react';
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
  
  const [sheetUrl, setSheetUrl] = useState<string>(() => localStorage.getItem('teamSync_sheetUrl') || '');
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('teamSync_sheetUrl', sheetUrl);
  }, [sheetUrl]);

  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>(new Date().toLocaleTimeString());
  const [quickAddInput, setQuickAddInput] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [showGuide, setShowGuide] = useState(false);

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
      console.error("Sync error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

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
        case 'status':
          updatedTask.statusId = columnId;
          break;
        case 'priority':
          updatedTask.priorityId = columnId;
          break;
        case 'assignee':
          updatedTask.assigneeId = columnId === 'unassigned' ? '' : columnId;
          break;
        case 'project':
          updatedTask.projectId = columnId === 'no-project' ? '' : columnId;
          break;
      }
      handleUpdateTask(updatedTask);
    }
  };

  const downloadSampleExcel = () => {
    const wb = XLSX.utils.book_new();
    const tasksData = tasks.map(t => {
      const assignee = users.find(u => u.id === t.assigneeId)?.name || '';
      const project = projects.find(p => p.id === t.projectId)?.name || '';
      const status = statuses.find(s => s.id === t.statusId)?.name || '';
      // Fixed: changed 'task.priorityId' to 't.priorityId' to refer to the current map item
      const priority = priorities.find(p => p.id === t.priorityId)?.name || '';
      return {
        "Task ID": t.id,
        "Title": t.title,
        "Description": t.description || '',
        "Status": status,
        "Priority": priority,
        "Due Date": t.dueDate,
        "Assignee": assignee,
        "Project": project,
        "Reference Links": (t.referenceLinks || []).join('\n'),
        "Activity Log": (t.comments || []).map(c => `[${users.find(u => u.id === c.authorId)?.name || 'User'}] ${c.text} (${c.createdAt})`).join('\n')
      };
    });
    const wsTasks = XLSX.utils.json_to_sheet(tasksData);
    XLSX.utils.book_append_sheet(wb, wsTasks, "Tasks");

    const wsMembers = XLSX.utils.json_to_sheet(users.map(u => ({
      "Member Name": u.name,
      "Email Address": u.email,
      "Internal ID": u.id,
      "Avatar URL": u.avatar
    })));
    XLSX.utils.book_append_sheet(wb, wsMembers, "Members");

    const wsProjects = XLSX.utils.json_to_sheet(projects.map(p => ({
      "Project Name": p.name,
      "Color Theme": p.color,
      "Internal ID": p.id
    })));
    XLSX.utils.book_append_sheet(wb, wsProjects, "Projects");

    const configData = [];
    const maxLen = Math.max(statuses.length, priorities.length);
    for(let i=0; i<maxLen; i++) {
      configData.push({
        "Status Options": statuses[i]?.name || '',
        "Priority Options": priorities[i]?.name || '',
        "Priority Color Code": priorities[i]?.color || ''
      });
    }
    const wsConfig = XLSX.utils.json_to_sheet(configData);
    XLSX.utils.book_append_sheet(wb, wsConfig, "Config");
    XLSX.writeFile(wb, "TeamSync_Master_Database.xlsx");
  };

  const APPS_SCRIPT_CODE = `/**
 * TEAMSYNC BRIDGE API
 * Handles 2-way sync between TeamSync Web App and Google Sheets
 */
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = {
    tasks: getSheetData(ss.getSheetByName("Tasks")),
    members: getSheetData(ss.getSheetByName("Members")),
    projects: getSheetData(ss.getSheetByName("Projects")),
    config: getSheetData(ss.getSheetByName("Config"))
  };
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(payload.targetSheet);
  if (!sheet) return ContentService.createTextOutput("Sheet not found").setMimeType(ContentService.MimeType.TEXT);
  upsertRow(sheet, payload.data, payload.idColumn || "Task ID");
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function getSheetData(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function upsertRow(sheet, data, idColName) {
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idIdx = headers.indexOf(idColName);
  const idValue = data[idColName];
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] == idValue) { rowIdx = i + 1; break; }
  }
  const newRow = headers.map(h => data[h] || "");
  if (rowIdx > 0) sheet.getRange(rowIdx, 1, 1, headers.length).setValues([newRow]);
  else sheet.appendRow(newRow);
}`;

  const copyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    alert('Bridge code copied to clipboard!');
  };

  const filteredTasks = tasks.filter(task => {
    const matchesProject = filterProject === 'all' || task.projectId === filterProject;
    const matchesAssignee = filterAssignee === 'all' || task.assigneeId === filterAssignee;
    return matchesProject && matchesAssignee;
  });

  const getColumns = () => {
    switch (groupBy) {
      case 'Status': return statuses.map(s => ({ id: s.id, title: s.name, type: 'status' }));
      case 'Priority': return priorities.map(p => ({ id: p.id, title: p.name, type: 'priority' }));
      case 'Assignee': return [...users.map(u => ({ id: u.id, title: u.name, avatar: u.avatar, type: 'assignee' })), { id: 'unassigned', title: 'Unassigned', type: 'assignee' }];
      case 'Project': return [...projects.map(p => ({ id: p.id, title: p.name, type: 'project' })), { id: 'no-project', title: 'No Project', type: 'project' }];
      default: return [];
    }
  };

  const isTaskInColumn = (task: Task, columnId: string) => {
    switch (groupBy) {
      case 'Status': return task.statusId === columnId;
      case 'Priority': return task.priorityId === columnId;
      case 'Assignee': return columnId === 'unassigned' ? !task.assigneeId : task.assigneeId === columnId;
      case 'Project': return columnId === 'no-project' ? !task.projectId : task.projectId === columnId;
      default: return false;
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

  const handleUpdateUser = (u: User) => { setUsers(prev => prev.map(x => x.id === u.id ? u : x)); };
  const handleAddUser = () => { setUsers(prev => [...prev, { id: `u${Date.now()}`, name: 'New Member', email: '', avatar: `https://picsum.photos/seed/${Date.now()}/40/40` }]); };
  const handleDeleteUser = (id: string) => { setUsers(prev => prev.filter(u => u.id !== id)); };

  const handleUpdateProject = (p: Project) => { setProjects(prev => prev.map(x => x.id === p.id ? p : x)); };
  const handleAddProject = () => { setProjects(prev => [...prev, { id: `p${Date.now()}`, name: 'New Project', color: 'bg-blue-100 text-blue-800' }]); };
  const handleDeleteProject = (id: string) => { setProjects(prev => prev.filter(p => p.id !== id)); };

  const handleUpdateStatus = (s: Status) => { setStatuses(prev => prev.map(x => x.id === s.id ? s : x)); };
  const handleAddStatus = () => { setStatuses(prev => [...prev, {id: `s${Date.now()}`, name: 'New Status'}]); };
  const handleDeleteStatus = (id: string) => { setStatuses(prev => prev.filter(x => x.id !== id)); };
  
  const handleUpdatePriority = (p: Priority) => { setPriorities(prev => prev.map(x => x.id === p.id ? p : x)); };
  const handleAddPriority = () => { setPriorities(prev => [...prev, {id: `pr${Date.now()}`, name: 'New Priority', color: 'bg-gray-100 text-gray-700 border-gray-200'}]); };
  const handleDeletePriority = (id: string) => { setPriorities(prev => prev.filter(x => x.id !== id)); };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddInput.trim()) return;
    
    // Using natural language parsing
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-100"><i className="fas fa-check"></i></div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">TeamSync</h1>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{isSyncing ? 'Syncing...' : `Synced ${lastSynced}`}</span>
            </div>
          </div>
          <div className="flex-1 max-w-xl w-full">
            <form onSubmit={handleQuickAdd} className="relative">
              <input value={quickAddInput} onChange={e => setQuickAddInput(e.target.value)} placeholder="Type a task title and press Enter..." className="w-full pl-10 pr-12 py-2.5 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm transition-all" />
              <i className="fas fa-plus-circle text-gray-300 absolute left-3.5 top-3.5 text-xs"></i>
            </form>
          </div>
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setShowGuide(true)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border shadow-sm ${sheetUrl ? 'bg-green-50 text-green-600 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100 animate-pulse'}`}
             >
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
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Filter Project</label>
                <select className="bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 px-3 py-1 focus:ring-2 focus:ring-blue-100 focus:outline-none cursor-pointer" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                  <option value="all">All Projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
             </div>
             <div className="flex items-center gap-3">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Filter Assignee</label>
                <select className="bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 px-3 py-1 focus:ring-2 focus:ring-blue-100 focus:outline-none cursor-pointer" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
                  <option value="all">All Members</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
             </div>
          </div>
          {(filterProject !== 'all' || filterAssignee !== 'all') && (
            <button onClick={() => { setFilterProject('all'); setFilterAssignee('all'); }} className="ml-auto text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest flex items-center gap-1">
              <i className="fas fa-times-circle"></i> Reset Filters
            </button>
          )}
        </div>
      )}

      <main className="flex-1 overflow-hidden p-6">
        {viewMode === 'sheet' ? (
          <SheetView 
            tasks={tasks} users={users} projects={projects} statuses={statuses} priorities={priorities} sheetUrl={sheetUrl}
            activeTabOverride={activeSheetTab}
            onTabChange={setActiveSheetTab}
            onUpdateSheetUrl={setSheetUrl} onUpdateTask={handleUpdateTask} onAddTask={handleAddTask} onDeleteTask={handleDeleteTask}
            onUpdateUser={handleUpdateUser} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser}
            onUpdateProject={handleUpdateProject} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject}
            onUpdateStatus={handleUpdateStatus} onAddStatus={handleAddStatus} onDeleteStatus={handleDeleteStatus}
            onUpdatePriority={handleUpdatePriority} onAddPriority={handleAddPriority} onDeletePriority={handleDeletePriority}
          />
        ) : (
          <div className="flex h-full gap-6 overflow-x-auto pb-6">
            {getColumns().map(column => {
                const columnTasks = filteredTasks.filter(t => isTaskInColumn(t, column.id));
                const isOver = draggedOverColumn === column.id;
                return (
                    <div 
                      key={column.id} 
                      className={`min-w-[320px] max-w-[400px] flex flex-col h-full transition-all duration-200 ${isOver ? 'scale-[1.02]' : ''}`}
                      onDragOver={(e) => handleDragOver(e, column.id)}
                      onDragLeave={() => setDraggedOverColumn(null)}
                      onDrop={(e) => handleDrop(e, column.id, column.type)}
                    >
                        <div className="flex items-center justify-between mb-4 px-3">
                            <h3 className={`font-black uppercase text-xs tracking-tighter transition-colors ${isOver ? 'text-blue-600' : 'text-gray-500'}`}>{column.title}</h3>
                            <span className="text-[10px] font-black text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full shadow-sm">
                                {columnTasks.length}
                            </span>
                        </div>
                        <div className={`flex-1 rounded-[2.5rem] p-4 overflow-y-auto space-y-4 border border-gray-200/50 shadow-inner sheet-scroll transition-colors ${isOver ? 'bg-blue-50/50' : 'bg-gray-100/40'}`}>
                            {columnTasks.map(task => (
                                <TaskCard 
                                    key={task.id} 
                                    task={task} 
                                    priority={priorities.find(p => p.id === task.priorityId)} 
                                    assignee={users.find(u => u.id === task.assigneeId)} 
                                    project={projects.find(p => p.id === task.projectId)} 
                                    onDragStart={handleDragStart} 
                                    onClick={setSelectedTask} 
                                />
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
            
            <div className="space-y-8 text-sm leading-relaxed text-gray-600">
              <div className="bg-blue-50 p-8 rounded-[2rem] border border-blue-100 space-y-4 shadow-sm">
                <h4 className="font-black text-blue-800 uppercase text-xs tracking-widest flex items-center gap-2">
                    <i className="fas fa-cog"></i> Bridge Setup
                </h4>
                <ol className="space-y-3 text-xs text-blue-900 font-medium list-decimal list-inside">
                    <li>Open your Google Sheet > <strong>Extensions</strong> > <strong>Apps Script</strong>.</li>
                    <li>Delete any code there and <strong>Paste the Bridge Code</strong> (copy below).</li>
                    <li>Click <strong>Deploy</strong> > <strong>New Deployment</strong> > Type: <strong>Web App</strong>.</li>
                    <li>Set 'Who has access' to <strong>Anyone</strong>.</li>
                    <li>Copy the <strong>Web App URL</strong> and paste it into the <strong>Settings</strong> tab here.</li>
                </ol>
                <div className="flex gap-4 mt-6">
                    <button onClick={copyScript} className="flex-1 py-4 bg-white text-blue-600 border border-blue-200 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2">
                      <i className="fas fa-copy"></i> Copy Bridge Code
                    </button>
                    <button onClick={() => { setViewMode('sheet'); setActiveSheetTab('settings'); setShowGuide(false); }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">
                      Go to Settings
                    </button>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Excel Template</h3>
                <p className="text-xs opacity-70">Download this to ensure your Google Sheet tabs match the TeamSync structure.</p>
                <button onClick={downloadSampleExcel} className="w-full py-4 bg-green-50 text-green-700 border border-green-200 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-green-100 transition-all">
                    <i className="fas fa-file-excel"></i> Download Master Excel Template
                </button>
              </div>
            </div>
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
                        <textarea className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm min-h-[100px] focus:ring-2 focus:ring-blue-100" value={selectedTask.description || ''} onChange={e => handleUpdateTask({...selectedTask, description: e.target.value})} placeholder="What needs to be done?" />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Reference Links</label>
                            <button onClick={() => handleUpdateTask({...selectedTask, referenceLinks: [...(selectedTask.referenceLinks || []), '']})} className="text-blue-600 font-bold text-[10px] uppercase tracking-widest">+ Add Link</button>
                        </div>
                        <div className="space-y-2">
                            {(selectedTask.referenceLinks || []).map((link, i) => (
                                <div key={i} className="flex gap-2">
                                    <input className="flex-1 p-2 bg-gray-50 rounded-lg text-xs font-mono border-none focus:ring-2 focus:ring-blue-100" value={link} placeholder="https://..." onChange={e => {
                                        const newLinks = [...(selectedTask.referenceLinks || [])];
                                        newLinks[i] = e.target.value;
                                        handleUpdateTask({...selectedTask, referenceLinks: newLinks});
                                    }} />
                                    {link && <a href={link} target="_blank" rel="noreferrer" className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><i className="fas fa-external-link-alt text-xs"></i></a>}
                                    <button onClick={() => {
                                        const iLink = (selectedTask.referenceLinks || []).filter((_, idx) => idx !== i);
                                        handleUpdateTask({...selectedTask, referenceLinks: iLink});
                                    }} className="p-2 text-gray-300 hover:text-red-500"><i className="fas fa-trash-alt text-xs"></i></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-4">Activity Trail</label>
                        <div className="space-y-4 mb-4 max-h-[200px] overflow-y-auto pr-2 sheet-scroll">
                            {(selectedTask.comments || []).length === 0 && <p className="text-xs text-gray-400 italic">No activity yet.</p>}
                            {(selectedTask.comments || []).map((comment) => (
                                <div key={comment.id} className="flex gap-3 items-start">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[8px] font-bold text-blue-600">
                                        {users.find(u => u.id === comment.authorId)?.name.charAt(0) || 'U'}
                                    </div>
                                    <div className="flex-1 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                                        <p className="text-xs text-gray-700">{comment.text}</p>
                                        <span className="text-[9px] text-gray-400 mt-1 block font-medium">
                                            {users.find(u => u.id === comment.authorId)?.name} • {new Date(comment.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="relative">
                            <input className="w-full pl-4 pr-12 py-3 bg-gray-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-blue-100" placeholder="Add a progress update..." value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment(selectedTask.id)} />
                            <button onClick={() => handleAddComment(selectedTask.id)} className="absolute right-3 top-2.5 p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><i className="fas fa-paper-plane text-xs"></i></button>
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
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Priority</label>
                        <select className="w-full p-3 bg-white rounded-xl border-none shadow-sm text-sm font-bold" value={selectedTask.priorityId} onChange={e => handleUpdateTask({...selectedTask, priorityId: e.target.value})}>
                        {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Assignee</label>
                        <select className="w-full p-3 bg-white rounded-xl border-none shadow-sm text-sm font-bold" value={selectedTask.assigneeId} onChange={e => handleUpdateTask({...selectedTask, assigneeId: e.target.value})}>
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Due Date</label>
                        <input type="date" className="w-full p-3 bg-white rounded-xl border-none shadow-sm text-sm font-bold" value={selectedTask.dueDate} onChange={e => handleUpdateTask({...selectedTask, dueDate: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Project</label>
                        <select className="w-full p-3 bg-white rounded-xl border-none shadow-sm text-sm font-bold" value={selectedTask.projectId} onChange={e => handleUpdateTask({...selectedTask, projectId: e.target.value})}>
                        <option value="">None</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="pt-4 border-t border-gray-200">
                      <button onClick={() => handleDeleteTask(selectedTask.id)} className="w-full py-3 bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-200 transition-colors"><i className="fas fa-trash-alt mr-2"></i> Delete Task</button>
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
