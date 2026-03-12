import Principal "mo:core/Principal";
import Array "mo:core/Array";
import Map "mo:core/Map";
import Int "mo:core/Int";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Initialize the access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile System (required by instructions)
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

  module ScoreEntry {
    public func compare(entry1 : ScoreEntry, entry2 : ScoreEntry) : Order.Order {
      Int.compare(entry2.score, entry1.score);
    };
  };

  let scores = Map.empty<Principal, ScoreEntry>();

  public shared ({ caller }) func submitScore(name : Text, score : Int) : async () {
    // Only authenticated users can submit scores
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
    // Public access - no authorization check needed
    let entries = scores.values().toArray();
    let sorted = entries.sort();
    let topEntries = sorted.sliceToArray(0, Int.min(10, entries.size()));
    topEntries;
  };

  public query ({ caller }) func getPersonalBest() : async ?ScoreEntry {
    // Only authenticated users can query their personal best
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view personal best");
    };
    scores.get(caller);
  };
};
