import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { loginSuccess, logout, setLoading } from "../store/authSlice";

const AuthWrapper = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token, isLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        dispatch(setLoading(false));
        return;
      }

      try {
        // Verify token with backend
        const response = await axios.get("http://127.0.0.1:8000/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Token is valid! Save user to Redux
        dispatch(loginSuccess({ user: response.data, token }));
      } catch (error) {
        // Token expired or invalid
        dispatch(logout());
        navigate("/login");
      }
    };

    checkToken();
  }, [token, dispatch, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#232323] text-white flex justify-center items-center">
        Loading Prism...
      </div>
    );
  }

  return children;
};

export default AuthWrapper;
