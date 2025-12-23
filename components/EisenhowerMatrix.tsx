
import React from 'react';
import { Task, Priority, Status } from '../types';

interface EisenhowerMatrixProps {
  tasks: Task[];
  priorities: Priority[];
  statuses: Status[];
  onSelectTask: (task: Task) => void;
}

const EisenhowerMatrix: React.FC<EisenhowerMatrixProps> = ({ tasks, priorities, statuses, onSelectTask }) => {
  
  const isDone = (statusId: string) => {
      const statusName = statuses.find(s => s.id === statusId)?.name;
      return statusName === 'Done' || statusId === 's4';
  };

  // 1. Filter active tasks first to determine relevant dates
  const activeTasks = tasks.filter(t => !isDone(t.statusId));

  // 2. Calculate Urgency Threshold based on dataset
  // Logic: "Earliest two dates = Urgent, Remaining dates = Not Urgent"
  const uniqueDates = Array.from(new Set(activeTasks.map(t => t.dueDate).filter(Boolean))).sort();
  const urgentDates = uniqueDates.slice(0, 2); // First 2 distinct dates present in the active tasks

  const isUrgent = (dateStr: string) => {
    if (!dateStr) return false;
    return urgentDates.includes(dateStr);
  };

  // 3. Calculate Importance
  // Logic: "Critical and High = Important, Medium and Low = Not Important"
  const isImportant = (priorityId: string) => {
    const priority = priorities.find(p => p.id === priorityId);
    if (!priority) return false;
    
    // Check against standard names or IDs (handling both App constants and Sheet sync data)
    const name = priority.name.toLowerCase();
    const id = priority.id;
    
    return name === 'critical' || name === 'high' || id === 'pr4' || id === 'pr3';
  };

  const q1 = activeTasks.filter(t => isUrgent(t.dueDate) && isImportant(t.priorityId)); // Do First
  const q2 = activeTasks.filter(t => !isUrgent(t.dueDate) && isImportant(t.priorityId)); // Schedule
  const q3 = activeTasks.filter(t => isUrgent(t.dueDate) && !isImportant(t.priorityId)); // Delegate
  const q4 = activeTasks.filter(t => !isUrgent(t.dueDate) && !isImportant(t.priorityId)); // Delete/Later

  const renderQuadrant = (title: string, subtitle: string, colorClass: string, taskList: Task[]) => (
    <div className={`flex flex-col h-full rounded-2xl border-2 ${colorClass} bg-white overflow-hidden shadow-sm`}>
       <div className={`p-4 border-b ${colorClass} bg-opacity-10`}>
          <h3 className="font-black text-gray-800 text-lg">{title}</h3>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{subtitle}</p>
       </div>
       <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-2 bg-gray-50/50">
          {taskList
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .map(task => {
                const priority = priorities.find(p => p.id === task.priorityId);
                return (
                    <div 
                        key={task.id} 
                        onClick={() => onSelectTask(task)}
                        className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 cursor-pointer transition-all group"
                    >
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-semibold text-gray-700 leading-tight line-clamp-2">{task.title}</span>
                            {priority && (
                                <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${priority.color.split(' ')[0]}`}></div>
                            )}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                             <span className={`${isUrgent(task.dueDate) ? 'text-red-500 font-bold' : ''}`}>
                                {new Date(task.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                             </span>
                             <i className="fas fa-expand opacity-0 group-hover:opacity-100 text-blue-400"></i>
                        </div>
                    </div>
                )
          })}
          {taskList.length === 0 && (
              <div className="h-full flex items-center justify-center text-gray-300 text-xs italic">
                  Empty
              </div>
          )}
       </div>
    </div>
  );

  return (
    <div className="h-full p-4 grid grid-cols-2 grid-rows-2 gap-4">
       {renderQuadrant("Do First", "Urgent & Important", "border-red-100", q1)}
       {renderQuadrant("Schedule", "Not Urgent & Important", "border-blue-100", q2)}
       {renderQuadrant("Delegate", "Urgent & Not Important", "border-orange-100", q3)}
       {renderQuadrant("Don't Do", "Not Urgent & Not Important", "border-gray-200", q4)}
    </div>
  );
};

export default EisenhowerMatrix;
