import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthWrapper from "./components/AuthWrapper";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import Yourdb from "./pages/Yourdb";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <AuthWrapper>
        <Routes>
          {/* --- PUBLIC ROUTES --- */}
          {/* If they go to "/", they get bounced to "/login" by the ProtectedRoute below */}
          <Route
            path="/login"
            element={
              <Layout>
                <Login />
              </Layout>
            }
          />
          <Route
            path="/register"
            element={
              <Layout>
                <Register />
              </Layout>
            }
          />

          {/* --- PROTECTED ROUTES --- */}
          {/* Anything inside this wrapper requires a valid token */}
          <Route element={<ProtectedRoute />}>
            {/* We wrap the protected pages in the Layout (Taskbar) */}
            <Route
              element={
                <Layout>
                  <Yourdb />
                </Layout>
              }
              path="/"
            />
            <Route
              element={
                <Layout>
                  <Yourdb />
                </Layout>
              }
              path="/choose-your-database"
            />
            <Route
              element={
                <Layout>
                  <Chat />
                </Layout>
              }
              path="/chat/:connectionId"
            />
          </Route>
        </Routes>
      </AuthWrapper>
    </BrowserRouter>
  );
}

export default App;
