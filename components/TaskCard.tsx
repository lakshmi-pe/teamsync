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
  const completedSubtasks = task.subtasks.filter(st => st.completed).length;
  const totalSubtasks = task.subtasks.length;
  const linkCount = task.referenceLinks?.length || 0;
  const commentCount = task.comments?.length || 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onClick(task)}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all active:scale-95 mb-3 group"
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${priority?.color || 'bg-gray-100'}`}>
          {priority?.name || 'No Priority'}
        </span>
        {project && (
            <span className={`text-[10px] font-black uppercase tracking-tight px-2 py-0.5 rounded-md ${project.color} opacity-80`}>
                {project.name}
            </span>
        )}
      </div>

      <h3 className="text-gray-800 font-medium mb-1 line-clamp-2">{task.title}</h3>
      
      <div className="flex items-center gap-3 mt-2 text-gray-400">
        {task.dueDate && (
          <div className="flex items-center text-[10px] font-medium">
            <i className="far fa-calendar-alt mr-1 text-[9px]"></i>
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
        )}
        {linkCount > 0 && (
          <div className="flex items-center text-[10px] font-bold text-blue-500">
            <i className="fas fa-link mr-1 text-[9px]"></i>
            {linkCount}
          </div>
        )}
        {commentCount > 0 && (
          <div className="flex items-center text-[10px] font-bold text-green-500">
            <i className="far fa-comment-dots mr-1 text-[9px]"></i>
            {commentCount}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
        <div className="flex items-center text-gray-400 text-[10px] font-black uppercase">
           {totalSubtasks > 0 && (
             <span className="flex items-center mr-3" title="Subtasks">
               <i className={`fas fa-check-circle mr-1.5 ${completedSubtasks === totalSubtasks ? 'text-green-500' : ''}`}></i>
               {completedSubtasks}/{totalSubtasks}
             </span>
           )}
        </div>

        {assignee ? (
          <img 
            src={assignee.avatar} 
            alt={assignee.name} 
            className="w-6 h-6 rounded-full border border-white shadow-sm ring-1 ring-gray-100"
            title={assignee.name}
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[8px] text-gray-400">
            <i className="fas fa-user"></i>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;