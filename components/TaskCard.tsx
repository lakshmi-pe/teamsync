
import React from 'react';
import { Task, User, Project, Priority, GroupByOption } from '../types';

interface TaskCardProps {
  task: Task;
  assignee?: User;
  project?: Project;
  priority?: Priority;
  groupBy: GroupByOption;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onClick: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  assignee, 
  project, 
  priority, 
  groupBy,
  onDragStart, 
  onClick
}) => {
  const linkCount = task.referenceLinks?.length || 0;
  const trailCount = task.activityTrail?.length || 0;
  const subtaskCount = task.subtasks?.length || 0;
  
  // Date formatting
  const dueDateObj = new Date(task.dueDate);
  const isOverdue = dueDateObj < new Date() && task.statusId !== 's4';
  const dateStr = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Determine border color based on priority
  let borderColor = 'border-gray-100';
  if (priority?.name === 'High') borderColor = 'border-orange-200';
  if (priority?.name === 'Critical') borderColor = 'border-red-200';

  return (
    <div 
      draggable 
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onClick(task)}
      className={`bg-white p-4 rounded-xl shadow-sm border ${borderColor} cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative overflow-hidden`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-gray-800 text-sm leading-snug flex-1 mr-2">{task.title}</h4>
        {/* If grouping by assignee, don't show avatar, etc. Context aware. */}
        {groupBy !== 'Assignee' && (
             assignee ? (
              <img 
                src={assignee.avatar} 
                alt={assignee.name} 
                className="w-6 h-6 rounded-full border border-white shadow-sm shrink-0"
                title={assignee.name}
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center border border-white shrink-0">
                <i className="fas fa-user text-[10px] text-gray-300"></i>
              </div>
            )
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {groupBy !== 'Project' && project && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md truncate max-w-[100px] ${project.color || 'bg-gray-100 text-gray-600'}`}>
            {project.name}
          </span>
        )}
        {groupBy !== 'Priority' && priority && (
           <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${priority.color}`}>
             {priority.name}
           </span>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Footer Metrics */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className={`flex items-center gap-1.5 text-[11px] font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
          <i className="far fa-calendar"></i>
          {dateStr}
        </div>
        
        <div className="flex gap-3 text-gray-400">
           {(subtaskCount > 0) && (
             <span className="text-[10px] flex items-center gap-1" title="Subtasks">
               <i className="fas fa-list-ul"></i> {subtaskCount}
             </span>
           )}
           {(trailCount > 0) && (
             <span className="text-[10px] flex items-center gap-1" title="Activity">
               <i className="far fa-comment-alt"></i> {trailCount}
             </span>
           )}
           {(linkCount > 0) && (
             <span className="text-[10px] flex items-center gap-1" title="Attachments">
               <i className="fas fa-paperclip"></i> {linkCount}
             </span>
           )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
