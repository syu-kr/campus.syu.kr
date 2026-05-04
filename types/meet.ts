export interface MeetRoom {
  id: string;
  title: string;
  description: string;
  dateStart: string;
  dateEnd: string;
  timeStart: string;
  timeEnd: string;
  slotMinutes: number;
  participantCount: number;
  responseClosesAt: string | null;
  acceptingResponses: boolean;
  expiresAt: string | null;
}

export interface MeetParticipant {
  nickname: string;
  availability: string[];
  updatedAt: string | null;
}

export interface MeetRoomResponse {
  room: MeetRoom;
  slots: string[];
  participants: MeetParticipant[];
}
