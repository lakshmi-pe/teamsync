
import React from 'react';
import { Task, User, Project, Priority } from '../types';

interface TaskCardProps {
  task: Task;
  assignee?: User;
  project?: Project;
  priority?: Priority;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onClick: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, assignee, project, priority, onDragStart, onClick }) => {
  const completedSubtasks = (task.subtasks || []).filter(st => st.completed).length;
  const totalSubtasks = (task.subtasks || []).length;
  const linkCount = task.referenceLinks?.length || 0;
  const commentCount = task.comments?.length || 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onClick(task)}
      className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-xl hover:border-blue-200 transition-all active:scale-[0.98] mb-4 group"
    >
      {/* Header: Project & Priority */}
      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
        {project && (
          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${project.color} shadow-sm border border-white/50`}>
            {project.name}
          </span>
        )}
        <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider shadow-sm ${priority?.color || 'bg-gray-50 border-gray-200'}`}>
          {priority?.name || 'No Priority'}
        </span>
      </div>

      {/* Task Title */}
      <h3 className="text-gray-900 font-bold text-sm mb-3 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
        {task.title}
      </h3>
      
      {/* Subtasks Preview */}
      {totalSubtasks > 0 && (
        <div className="space-y-1.5 mb-4">
          {task.subtasks.slice(0, 3).map((st, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
              <i className={`fas ${st.completed ? 'fa-check-circle text-green-500' : 'fa-circle text-gray-200'} text-[9px]`}></i>
              <span className={`line-clamp-1 ${st.completed ? 'line-through opacity-60' : ''}`}>{st.title}</span>
            </div>
          ))}
          {totalSubtasks > 3 && (
            <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest pl-4">
              + {totalSubtasks - 3} more
            </div>
          )}
        </div>
      )}

      {/* Footer Info: Date, Links, Comments */}
      <div className="flex items-center gap-4 mb-4 text-gray-400">
        {task.dueDate && (
          <div className="flex items-center text-[10px] font-black uppercase tracking-tighter text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
            <i className="far fa-calendar-alt mr-1.5 text-[10px] text-blue-400"></i>
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
        )}
        {linkCount > 0 && (
          <div className="flex items-center text-[10px] font-black text-blue-500">
            <i className="fas fa-link mr-1"></i>
            {linkCount}
          </div>
        )}
        {commentCount > 0 && (
          <div className="flex items-center text-[10px] font-black text-green-600">
            <i className="far fa-comment-dots mr-1"></i>
            {commentCount}
          </div>
        )}
      </div>

      {/* Assignee Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-gray-50">
        <div className="flex items-center gap-2">
          {assignee ? (
            <>
              <img 
                src={assignee.avatar} 
                alt={assignee.name} 
                className="w-7 h-7 rounded-xl border-2 border-white shadow-md ring-1 ring-gray-100"
              />
              <span className="text-[10px] font-black text-gray-700 uppercase tracking-tighter truncate max-w-[100px]">
                {assignee.name}
              </span>
            </>
          ) : (
            <>
              <div className="w-7 h-7 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-[10px] text-gray-300">
                <i className="fas fa-user-secret"></i>
              </div>
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">
                Unassigned
              </span>
            </>
          )}
        </div>
        
        {totalSubtasks > 0 && (
          <div className="flex items-center bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
             <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden mr-2 shadow-inner">
               <div 
                 className={`h-full ${completedSubtasks === totalSubtasks ? 'bg-green-500' : 'bg-blue-500'} transition-all`}
                 style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
               ></div>
             </div>
             <span className="text-[9px] font-black text-gray-500">{completedSubtasks}/{totalSubtasks}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
