
import * as XLSX from 'xlsx';

export const downloadTemplate = () => {
  const wb = XLSX.utils.book_new();

  // 1. Tasks Sheet
  const tasksHeaders = [
    "ID", "Title", "Description", "Status", "Priority", 
    "DueDate", "Assignee", "Project", "RefLinks", "ActivityTrail", "Subtasks"
  ];
  const tasksData = [
    [
      "t1", "Sample Task", "Description of the task", "To Do", "Medium", 
      new Date().toISOString().split('T')[0], "Alice Johnson", "Website Redesign", 
      "http://google.com", "Created today", "- Subtask 1\n- Subtask 2"
    ]
  ];
  const wsTasks = XLSX.utils.aoa_to_sheet([tasksHeaders, ...tasksData]);
  XLSX.utils.book_append_sheet(wb, wsTasks, "Tasks");

  // 2. Team Members Sheet
  const membersHeaders = ["Name", "Email", "AvatarUrl"];
  const membersData = [
    ["Alice Johnson", "alice@company.com", "https://ui-avatars.com/api/?name=Alice+Johnson&background=random"],
    ["Bob Smith", "bob@company.com", "https://ui-avatars.com/api/?name=Bob+Smith&background=random"],
    ["Charlie Davis", "charlie@company.com", "https://ui-avatars.com/api/?name=Charlie+Davis&background=random"],
    ["Diana Prince", "diana@company.com", "https://ui-avatars.com/api/?name=Diana+Prince&background=random"],
    ["Evan Wright", "evan@company.com", "https://ui-avatars.com/api/?name=Evan+Wright&background=random"]
  ];
  const wsMembers = XLSX.utils.aoa_to_sheet([membersHeaders, ...membersData]);
  XLSX.utils.book_append_sheet(wb, wsMembers, "Team Members");

  // 3. Projects Sheet
  const projectsHeaders = ["Name", "ColorHex"];
  const projectsData = [
    ["Website Redesign", "#DBEAFE"],
    ["Q4 Marketing", "#DCFCE7"],
    ["Internal Audit", "#F3E8FF"]
  ];
  const wsProjects = XLSX.utils.aoa_to_sheet([projectsHeaders, ...projectsData]);
  XLSX.utils.book_append_sheet(wb, wsProjects, "Projects");

  // 4. Status Sheet
  const statusHeaders = ["Name"];
  const statusData = [["To Do"], ["In Progress"], ["Review"], ["Done"]];
  const wsStatus = XLSX.utils.aoa_to_sheet([statusHeaders, ...statusData]);
  XLSX.utils.book_append_sheet(wb, wsStatus, "Status");

  // 5. Priority Sheet
  const priorityHeaders = ["Name", "ColorClass"];
  const priorityData = [
    ["Low", "bg-gray-100 text-gray-700"],
    ["Medium", "bg-blue-100 text-blue-700"],
    ["High", "bg-orange-100 text-orange-700"],
    ["Critical", "bg-red-100 text-red-700"]
  ];
  const wsPriority = XLSX.utils.aoa_to_sheet([priorityHeaders, ...priorityData]);
  XLSX.utils.book_append_sheet(wb, wsPriority, "Priority");

  // Download
  XLSX.writeFile(wb, "TeamSync_Template.xlsx");
};
