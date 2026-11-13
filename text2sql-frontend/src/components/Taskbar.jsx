import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  ChevronsLeft,
  LogOut,
  MessageCirclePlus,
  PanelLeft,
  Search,
} from "lucide-react";
import { logout } from "../store/authSlice";
import { setPanelOpen, togglePanel } from "../store/uiSlice";
import logo from "../assets/pism.png";

const Taskbar = () => {
  // Get the authentication status from Redux
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isChatPage = location.pathname.startsWith("/chat");

  // --- THE LOGOUT FUNCTION ---
  const handleLogout = () => {
    dispatch(logout()); // 1. Clear Redux state & localStorage
    navigate("/login"); // 2. Redirect to login page
  };

  return (
    <nav className="backdrop-blur-3xl text-[#cdcdcd] py-2 w-full px-4 md:px-10 xl:px-14 z-20">
      <div className=" w-full ">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <div className="flex flex-row items-center gap-4">
            {isAuthenticated && isChatPage ? (
              <>
                <Link
                  to="/choose-your-database"
                  className="p-2 rounded-full font-medium hover:bg-black/20 transition-colors hover:shadow-md duration-300"
                >
                  <ChevronsLeft
                    size={18}
                    strokeWidth={1}
                    className="color-[#cdcdcd]"
                  />
                </Link>
              </>
            ) : (
              <></>
            )}
            <Link
              to="/"
              className="text-xl font-bold flex flex-row gap-2 items-center justify-center"
            >
              <div className="relative w-auto h-auto">
                {/* <img
                  src="../src/assets/logo.svg"
                  alt="logo"
                  className="h-10 w-10"
                />
                <img
                  src="../src/assets/data-server.png"
                  alt=""
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5"
                /> */}
                <img src={logo} alt="" className="h-8 w-8" />
              </div>
              <div className="flex flex-row text-2xl gap-1 font-light tracking-wider">
                <span className="forum">Prism</span>
              </div>
            </Link>
            {isAuthenticated ? (
              isChatPage ? (
                <div className="flex flex-row items-center gap-2 p-2 bg-black/20 rounded-full">
                  <div
                    className="h-10 w-10 cursor-pointer flex items-center justify-center hover:bg-[#232323] rounded-full"
                    onClick={() => dispatch(togglePanel())}
                  >
                    <PanelLeft size={16} className="" />
                  </div>
                  <div className="h-10 w-10 cursor-pointer flex items-center justify-center hover:bg-[#232323] rounded-full">
                    <Search size={16} className="" />
                  </div>
                  <div className="h-10 w-10 cursor-pointer flex items-center justify-center hover:bg-[#232323] rounded-full">
                    <MessageCirclePlus size={16} className="" />
                  </div>
                </div>
              ) : null
            ) : null}
          </div>

          {/* Navigation Links Section */}
          <div className="flex space-x-4 font-forum text-md">
            {/* If logged out, show Register and Login */}
            {!isAuthenticated ? (
              <>
                <Link
                  to="/register"
                  className="px-3 py-2 rounded-md font-medium hover:bg-gray-700 transition-colors"
                >
                  Register
                </Link>
                <Link
                  to="/login"
                  className="px-3 py-2 rounded-md font-medium hover:bg-gray-700 transition-colors"
                >
                  Login
                </Link>
              </>
            ) : (
              /* If logged in, show Chat */
              <>
                {/* <Link
                  to="/chat"
                  className="p-3 rounded-full font-medium hover:bg-black/20 transition-colors hover:shadow-md duration-300"
                >
                  <img
                    src="../src/assets/share.png"
                    alt=""
                    className="h-4 w-4"
                  />
                </Link> */}
                <div
                  onClick={handleLogout}
                  to="/chat"
                  className="p-3 rounded-full font-medium hover:bg-black/20 transition-colors hover:shadow-md duration-300 cursor-pointer"
                >
                  <LogOut size={16} className="text-[#cdcdcd]" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Taskbar;
