import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom"

import { AuthProvider } from "@/auth/auth-provider"
import { ProtectedRoute } from "@/auth/protected-route"
import { AppLayout } from "@/components/layout/app-layout"
import { DashboardPage } from "@/pages/dashboard-page"
import { LoginPage } from "@/pages/login-page"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            element={
              <ProtectedRoute />
            }
          >
            <Route
              element={<AppLayout />}
            >
              <Route
                index
                element={
                  <DashboardPage />
                }
              />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App