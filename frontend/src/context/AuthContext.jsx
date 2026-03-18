import React from "react";

export const AuthContext = React.createContext({
  isAuthed: null,
  setIsAuthed: () => {},
  isManager: false,
  setIsManager: () => {},
});
