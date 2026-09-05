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
import { DepartmentsPage } from "@/pages/departments/departments-page"
import { EmployeeDetailsPage } from "@/pages/employees/employee-details-page"
import { EmployeesPage } from "@/pages/employees/employees-page"
import { JobPositionsPage } from "@/pages/job-positions/job-positions-page"

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
              <Route
                path="employees"
                element={
                  <EmployeesPage />
                }
              />

              <Route
                path="employees/:id"
                element={
                  <EmployeeDetailsPage />
                }
              />

              <Route
                path="departments"
                element={
                  <DepartmentsPage />
                }
              />

              <Route
                path="job-positions"
                element={
                  <JobPositionsPage />
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