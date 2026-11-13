import Taskbar from "./Taskbar";

const Layout = ({ children }) => {
  return (
    <div className="h-screen w-screen bg-[#232323] flex flex-col overflow-hidden">
      <div className="shrink-0">
        <Taskbar />
      </div>

      <main className="w-full h-full">
        <div className="w-full h-full ">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
