"use client";
// import "../LandingPage/layout.css";

import { FC, ReactNode } from "react";

const LandingPageLayout: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <>
      <section className='relative w-full'>
        {/* <Navbar /> */}
        <div
          style={{
            maxWidth: "80vw",
            margin: "0 auto",
          }}
          // className=" relative z-1 top-[60px] bottom-[60px]"
        >
          {children}
        </div>
      </section>
    </>
  );
};

export default LandingPageLayout;
