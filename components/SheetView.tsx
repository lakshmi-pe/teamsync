
import React from 'react';
import { Task, User, Project, Status, Priority } from '../types';

interface SheetViewProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  statuses: Status[];
  priorities: Priority[];
  sheetUrl: string;
  onUpdateSheetUrl: (url: string) => void;
  onRefresh: () => void;
  onUpdateTask: (task: Task) => void;
  onSelectTask: (task: Task) => void;
  onAddProject: () => void;
  onAddMember: () => void;
}

const SheetView: React.FC<SheetViewProps> = ({ 
  tasks, 
  users, 
  projects, 
  statuses, 
  priorities,
  sheetUrl, 
  onUpdateSheetUrl, 
  onRefresh,
  onUpdateTask,
  onSelectTask,
  onAddProject,
  onAddMember
}) => {

  const handleInputChange = (task: Task, field: keyof Task, value: any) => {
    onUpdateTask({ ...task, [field]: value });
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Sync Control Bar */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 justify-between items-center bg-gray-50">
         <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-table text-blue-500"></i> Spreadsheet View
            </h2>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex gap-2">
               <button onClick={onAddProject} className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                 <i className="fas fa-plus mr-1 text-blue-500"></i> Project
               </button>
               <button onClick={onAddMember} className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                 <i className="fas fa-plus mr-1 text-green-500"></i> Member
               </button>
            </div>
         </div>
         <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Paste Web App URL here..." 
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs w-64 focus:ring-2 focus:ring-blue-100 outline-none"
              value={sheetUrl}
              onChange={(e) => onUpdateSheetUrl(e.target.value)}
            />
            <button onClick={onRefresh} className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors">
              Sync Now
            </button>
         </div>
      </div>

      {/* Editable Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-200 w-64">Title</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-200 w-32">Status</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-200 w-32">Priority</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-200 w-40">Assignee</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-200 w-40">Project</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-200 w-36">Due Date</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-gray-200 w-24 text-center">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.length === 0 ? (
               <tr>
                 <td colSpan={7} className="p-10 text-center text-gray-400 text-sm">
                   No tasks found. Add a task or sync with a sheet.
                 </td>
               </tr>
            ) : (
              tasks.map(task => (
                <tr key={task.id} className="hover:bg-blue-50/20 transition-colors group">
                  {/* Title */}
                  <td className="p-2 border-r border-transparent">
                    <input 
                      className="w-full bg-transparent px-2 py-1.5 rounded text-sm font-semibold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                      value={task.title}
                      onChange={(e) => handleInputChange(task, 'title', e.target.value)}
                    />
                  </td>

                  {/* Status */}
                  <td className="p-2">
                    <select 
                      className="w-full bg-transparent px-2 py-1.5 rounded text-xs font-medium text-gray-600 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 cursor-pointer"
                      value={task.statusId}
                      onChange={(e) => handleInputChange(task, 'statusId', e.target.value)}
                    >
                      {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>

                  {/* Priority */}
                  <td className="p-2">
                    <select 
                      className="w-full bg-transparent px-2 py-1.5 rounded text-xs font-medium text-gray-600 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 cursor-pointer"
                      value={task.priorityId}
                      onChange={(e) => handleInputChange(task, 'priorityId', e.target.value)}
                    >
                      {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>

                  {/* Assignee */}
                  <td className="p-2">
                    <select 
                      className="w-full bg-transparent px-2 py-1.5 rounded text-xs font-medium text-gray-600 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 cursor-pointer"
                      value={task.assigneeId}
                      onChange={(e) => handleInputChange(task, 'assigneeId', e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>

                  {/* Project */}
                  <td className="p-2">
                    <select 
                      className="w-full bg-transparent px-2 py-1.5 rounded text-xs font-medium text-gray-600 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 cursor-pointer"
                      value={task.projectId}
                      onChange={(e) => handleInputChange(task, 'projectId', e.target.value)}
                    >
                      <option value="">No Project</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>

                  {/* Due Date */}
                  <td className="p-2">
                    <input 
                      type="date"
                      className="w-full bg-transparent px-2 py-1.5 rounded text-xs text-gray-500 font-mono outline-none focus:bg-white focus:ring-2 focus:ring-blue-100"
                      value={task.dueDate}
                      onChange={(e) => handleInputChange(task, 'dueDate', e.target.value)}
                    />
                  </td>

                  {/* Edit Button for Complex Fields */}
                  <td className="p-2 text-center">
                    <button 
                      onClick={() => onSelectTask(task)}
                      className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-all"
                      title="Edit Description, Subtasks, Links, & Activity"
                    >
                      <i className="fas fa-expand-alt text-xs"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SheetView;
