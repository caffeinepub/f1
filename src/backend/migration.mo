import Map "mo:core/Map";
import Int "mo:core/Int";
import List "mo:core/List";
import Principal "mo:core/Principal";

module {
  type ScoreEntry = {
    name : Text;
    score : Int;
  };

  // Old actor state type
  type OldActor = {
    userProfiles : Map.Map<Principal, { name : Text }>;
    scores : Map.Map<Principal, ScoreEntry>;
  };

  // Internal room type
  type InternalRoom = {
    code : Text;
    host : Principal;
    createdAt : Int;
    players : List.List<{
      id : Principal;
      name : Text;
      score : ?Int;
      finishTime : ?Int;
      hasFinished : Bool;
    }>;
    isActive : Bool;
  };

  // New actor state type
  type NewActor = {
    userProfiles : Map.Map<Principal, { name : Text }>;
    scores : Map.Map<Principal, ScoreEntry>;
    rooms : Map.Map<Text, InternalRoom>;
  };

  // Migration function
  public func run(old : OldActor) : NewActor {
    {
      old with
      rooms = Map.empty<Text, InternalRoom>();
    };
  };
};
