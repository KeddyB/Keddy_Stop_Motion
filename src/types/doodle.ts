export interface Point {
  x: number;
  y: number;
}

export interface DoodleStroke {
  id: string;
  points: Point[];
  color: string;
  strokeWidth: number;
}
