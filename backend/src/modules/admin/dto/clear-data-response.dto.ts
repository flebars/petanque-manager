export interface ClearDataResponseDto {
  success: true;
  message: string;
  deleted: {
    tournaments: number;
    teams: number;
    matches: number;
    users: number;
  };
  preserved: {
    adminUsers: number;
  };
}
