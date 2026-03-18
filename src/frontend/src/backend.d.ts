import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface RoomState {
    allFinished: boolean;
    players: Array<Player>;
}
export interface Player {
    id: Principal;
    name: string;
    hasFinished: boolean;
    score?: bigint;
    finishTime?: bigint;
}
export interface ChatMessage {
    sender: string;
    isReaction: boolean;
    message: string;
    timestamp: bigint;
}
export interface ScoreEntry {
    name: string;
    score: bigint;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    cleanExpiredRooms(): Promise<void>;
    createRoom(): Promise<string>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getChatMessages(roomCode: string): Promise<Array<ChatMessage>>;
    getLeaderboard(): Promise<Array<ScoreEntry>>;
    getPersonalBest(): Promise<ScoreEntry | null>;
    getRoomPlayers(roomCode: string): Promise<Array<Player>>;
    getRoomState(roomCode: string): Promise<RoomState>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    isRoomActive(code: string): Promise<boolean>;
    joinRoom(code: string, playerName: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    sendChatMessage(roomCode: string, message: string): Promise<void>;
    sendReaction(roomCode: string, reaction: string): Promise<void>;
    submitRaceScore(roomCode: string, score: bigint, finishTime: bigint): Promise<void>;
    submitScore(name: string, score: bigint): Promise<void>;
}
