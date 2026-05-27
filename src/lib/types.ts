// These match the SQLite column names (snake_case)
export interface Board {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Release {
  id: string;
  board_id: string;
  name: string;
  position: number;
  target_date?: string;
  notes?: string;
  created_at: string;
}

export interface Sprint {
  id: string;
  release_id: string;
  name: string;
  position: number;
  capacity: number;
  capacity_unit: string;
  notes?: string;
  created_at: string;
}

export interface Task {
  id: string;
  sprint_id: string;
  title: string;
  description?: string;
  estimate: number;
  color: string;
  is_critical: number; // SQLite stores 0/1
  position: number;
  created_at: string;
}

export interface Dependency {
  id: string;
  from_task_id: string;
  to_task_id: string;
  created_at: string;
}

// Board state as seen by the client — fully nested
export interface BoardState {
  board: Board;
  releases: (Release & {
    sprints: (Sprint & {
      tasks: Task[];
    })[];
  })[];
  dependencies: Dependency[];
}