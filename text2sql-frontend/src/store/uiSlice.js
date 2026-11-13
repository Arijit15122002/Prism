import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  panelOpen: false, // You can add more UI states here later (e.g., theme: 'dark')
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    // Action to toggle the panel
    togglePanel: (state) => {
      state.panelOpen = !state.panelOpen;
    },
    // Action to explicitly set it to true or false
    setPanelOpen: (state, action) => {
      state.panelOpen = action.payload;
    },
  },
});

export const { togglePanel, setPanelOpen } = uiSlice.actions;
export default uiSlice.reducer;
