import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/layout/app-layout.js";
import { getDashboardRuntimeConfig } from "./lib/dashboard-runtime.js";
import { DEFAULT_ROUTE } from "./lib/navigation.js";
import { AuctionPage } from "./pages/auction-page.js";
import { OrdersPage } from "./pages/orders-page.js";
import { ProfilePage } from "./pages/profile-page.js";
import { WindowViewPage } from "./pages/window-view-page.js";

const runtimeConfig = getDashboardRuntimeConfig();

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <AppLayout />,
      children: [
        {
          index: true,
          element: <Navigate replace to={DEFAULT_ROUTE} />,
        },
        {
          path: "orders",
          element: <OrdersPage />,
        },
        {
          path: "auction",
          element: <AuctionPage />,
        },
        {
          path: "profile",
          element: <ProfilePage />,
        },
        {
          path: "window-view",
          element: <WindowViewPage />,
        },
        {
          path: "*",
          element: <Navigate replace to={DEFAULT_ROUTE} />,
        },
      ],
    },
  ],
  {
    basename: runtimeConfig.routePrefix || undefined,
  },
);
