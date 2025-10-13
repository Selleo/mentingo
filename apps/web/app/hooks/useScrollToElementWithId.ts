import { useLocation } from "@remix-run/react";
import { useEffect } from "react";

export const useScrollToElementWithId = (isDataLoaded: boolean) => {
  const location = useLocation();

  useEffect(() => {
    if (!isDataLoaded) return;

    const hash = location.hash;
    if (hash) {
      const announcementId = hash.substring(1);
      const element = document.getElementById(announcementId);
      if (element) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            element.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });

            element.style.transition = "box-shadow 0.3s ease-in-out";
            element.style.boxShadow = "0 0 0 2px rgba(79, 111, 201, 0.3)";

            setTimeout(() => {
              element.style.boxShadow = "";
              setTimeout(() => {
                element.style.transition = "";
              }, 300);
            }, 1000);
          }, 100);
        });
      }
    }
  }, [location.hash, isDataLoaded]);
};
