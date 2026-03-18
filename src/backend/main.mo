import Principal "mo:core/Principal";
import Array "mo:core/Array";
import Map "mo:core/Map";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Char "mo:core/Char";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import List "mo:core/List";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

// Use migration for data add

actor {
  // Access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile
  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Leaderboard System
  type ScoreEntry = {
    name : Text;
    score : Int;
  };

  let scores = Map.empty<Principal, ScoreEntry>();

  module ScoreEntry {
    public func compare(entry1 : ScoreEntry, entry2 : ScoreEntry) : Order.Order {
      Int.compare(entry2.score, entry1.score);
    };
  };

  public shared ({ caller }) func submitScore(name : Text, score : Int) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can submit scores");
    };

    switch (scores.get(caller)) {
      case (null) {
        scores.add(caller, { name; score });
      };
      case (?existing) {
        if (score > existing.score) {
          scores.add(caller, { name; score });
        };
      };
    };
  };

  public query ({ caller }) func getLeaderboard() : async [ScoreEntry] {
    let entries = scores.values().toArray();
    let sorted = entries.sort();
    let topEntries = sorted.sliceToArray(0, Int.min(10, entries.size()));
    topEntries;
  };

  public query ({ caller }) func getPersonalBest() : async ?ScoreEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view personal best");
    };
    scores.get(caller);
  };

  // Multiplayer Rooms
  public type Player = {
    id : Principal;
    name : Text;
    score : ?Int;
    finishTime : ?Int;
    hasFinished : Bool;
  };

  public type Room = {
    code : Text;
    host : Principal;
    createdAt : Int;
    players : [Player];
    isActive : Bool;
  };

  public type RoomState = {
    players : [Player];
    allFinished : Bool;
  };

  public type ChatMessage = {
    sender : Text;
    message : Text;
    timestamp : Int;
    isReaction : Bool;
  };

  type InternalRoom = {
    code : Text;
    host : Principal;
    createdAt : Int;
    players : List.List<Player>;
    isActive : Bool;
    chatMessages : List.List<ChatMessage>;
  };

  let rooms = Map.empty<Text, InternalRoom>();
  let roomLifetime = 2 * 60 * 60 * 1_000_000_000;

  public shared ({ caller }) func createRoom() : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create rooms");
    };

    let code = await generateUniqueCode();
    let currentTime = Time.now();

    let newRoom : InternalRoom = {
      code;
      host = caller;
      createdAt = currentTime;
      players = List.empty<Player>();
      isActive = true;
      chatMessages = List.empty<ChatMessage>();
    };

    rooms.add(code, newRoom);
    code;
  };

  public shared ({ caller }) func joinRoom(
    code : Text,
    playerName : Text,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can join rooms");
    };

    switch (rooms.get(code)) {
      case (null) { Runtime.trap("Room not found") };
      case (?room) {
        if (not room.isActive) {
          Runtime.trap("Room is no longer active");
        };

        if (room.players.size() >= 8) {
          Runtime.trap("Room is full");
        };

        if (room.players.any(func(p) { p.name == playerName })) {
          Runtime.trap("Player name already taken");
        };

        switch (room.players.find(func(p) { p.id == caller })) {
          case (?existingPlayer) {
            if (existingPlayer.hasFinished) {
              Runtime.trap("Player has already finished the race");
            };
          };
          case (null) {};
        };

        let newPlayer : Player = {
          id = caller;
          name = playerName;
          score = null;
          finishTime = null;
          hasFinished = false;
        };

        room.players.add(newPlayer);
      };
    };
  };

  public shared ({ caller }) func submitRaceScore(
    roomCode : Text,
    score : Int,
    finishTime : Int,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can submit race scores");
    };

    switch (rooms.get(roomCode)) {
      case (null) { Runtime.trap("Room not found") };
      case (?room) {
        if (not room.isActive) {
          Runtime.trap("Room is no longer active");
        };

        let updatedPlayers = room.players.map<Player, Player>(
          func(player) {
            if (player.id == caller) {
              if (player.hasFinished) {
                Runtime.trap("Player has already finished the race");
              };
              {
                player with
                score = ?score;
                finishTime = ?finishTime;
                hasFinished = true;
              };
            } else {
              player;
            };
          }
        );

        room.players.clear();

        for (player in updatedPlayers.values()) {
          room.players.add(player);
        };
      };
    };
  };

  public shared ({ caller }) func sendChatMessage(roomCode : Text, message : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can chat");
    };

    if (message.size() == 0) {
      Runtime.trap("Message cannot be empty");
    };

    switch (rooms.get(roomCode)) {
      case (null) { Runtime.trap("Room not found") };
      case (?room) {
        if (not room.isActive) {
          Runtime.trap("Room is no longer active");
        };

        let senderName = switch (room.players.find(func(player) { player.id == caller })) {
          case (?player) { player.name };
          case (null) { "Unknown" };
        };

        let newMessage : ChatMessage = {
          sender = senderName;
          message = Text.fromArray(message.toArray().sliceToArray(0, Nat.min(200, message.size())));
          timestamp = Time.now();
          isReaction = false;
        };

        if (room.chatMessages.size() >= 50) {
          let newChatMessages = switch (room.chatMessages.last()) {
            case (?_) {
              ignore room.chatMessages.removeLast();
              room.chatMessages;
            };
            case (null) { room.chatMessages };
          };
          newChatMessages.add(newMessage);
        } else {
          room.chatMessages.add(newMessage);
        };
      };
    };
  };

  public shared ({ caller }) func sendReaction(roomCode : Text, reaction : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can react");
    };

    switch (rooms.get(roomCode)) {
      case (null) { Runtime.trap("Room not found") };
      case (?room) {
        if (not room.isActive) {
          Runtime.trap("Room is no longer active");
        };

        let senderName = switch (room.players.find(func(player) { player.id == caller })) {
          case (?player) { player.name };
          case (null) { "Unknown" };
        };

        let newReaction : ChatMessage = {
          sender = senderName;
          message = reaction;
          timestamp = Time.now();
          isReaction = true;
        };

        if (room.chatMessages.size() >= 50) {
          let newChatMessages = switch (room.chatMessages.last()) {
            case (?_) {
              ignore room.chatMessages.removeLast();
              room.chatMessages;
            };
            case (null) { room.chatMessages };
          };
          newChatMessages.add(newReaction);
        } else {
          room.chatMessages.add(newReaction);
        };
      };
    };
  };

  public query ({ caller }) func getRoomState(roomCode : Text) : async RoomState {
    switch (rooms.get(roomCode)) {
      case (null) { Runtime.trap("Room not found") };
      case (?room) {
        if (not room.isActive) {
          Runtime.trap("Room is no longer active");
        };

        let playersArray = room.players.toArray();
        {
          players = playersArray;
          allFinished = playersArray.all(func(p) { p.hasFinished });
        };
      };
    };
  };

  public query ({ caller }) func getRoomPlayers(roomCode : Text) : async [Player] {
    switch (rooms.get(roomCode)) {
      case (null) { Runtime.trap("Room not found") };
      case (?room) {
        if (not room.isActive) {
          Runtime.trap("Room is no longer active");
        };
        room.players.toArray();
      };
    };
  };

  public query ({ caller }) func getChatMessages(roomCode : Text) : async [ChatMessage] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view chat messages");
    };

    switch (rooms.get(roomCode)) {
      case (null) { Runtime.trap("Room not found") };
      case (?room) {
        if (not room.isActive) {
          Runtime.trap("Room is no longer active");
        };

        // Verify caller is a participant in the room or is an admin
        let isParticipant = room.players.any(func(player) { player.id == caller });
        let isAdminUser = AccessControl.isAdmin(accessControlState, caller);

        if (not isParticipant and not isAdminUser) {
          Runtime.trap("Unauthorized: Only room participants can view chat messages");
        };

        room.chatMessages.toArray();
      };
    };
  };

  public query ({ caller }) func isRoomActive(code : Text) : async Bool {
    switch (rooms.get(code)) {
      case (null) { Runtime.trap("Room not found") };
      case (?room) { room.isActive };
    };
  };

  func generateRoomCode() : Text {
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = Array.tabulate(
      6,
      func(i) {
        let char = chars.toArray()[i % chars.size()];
        char;
      },
    );
    Text.fromArray(code);
  };

  public shared ({ caller }) func cleanExpiredRooms() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can clean expired rooms");
    };

    let currentTime = Time.now();
    let expiredCodes = rooms.keys().toArray().filter(
      func(code) {
        switch (rooms.get(code)) {
          case (null) { false };
          case (?room) {
            room.isActive and currentTime - room.createdAt > roomLifetime;
          };
        };
      }
    );

    for (code in expiredCodes.values()) {
      switch (rooms.get(code)) {
        case (null) {};
        case (?room) {
          rooms.add(
            code,
            {
              room with
              isActive = false;
            },
          );
        };
      };
    };
  };

  func generateUniqueCode() : async Text {
    var attempts = 0;
    let start = Time.now();
    var code = generateRoomCode();
    while (
      (rooms.containsKey(code) or attempts == 0) and (Time.now() - start < 100_000_000) and attempts < 100
    ) {
      code := generateRoomCode();
      attempts += 1;
    };
    code;
  };
};

