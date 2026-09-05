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
import { AttendancePage } from "@/pages/attendance/attendance-page"
import { MyAttendancePage } from "@/pages/attendance/my-attendance-page"
import { LeaveManagementPage } from "@/pages/leave/leave-management-page"
import { MyLeavePage } from "@/pages/leave/my-leave-page"
import { SalaryStructuresPage } from "@/pages/salary/salary-structures-page"
import { SalaryStructureDetailsPage } from "@/pages/salary/salary-structure-details-page"
import { ContractsPage } from "@/pages/contracts/contracts-page"
import { DepartmentsPage } from "@/pages/departments/departments-page"
import { EmployeeDetailsPage } from "@/pages/employees/employee-details-page"
import { EmployeesPage } from "@/pages/employees/employees-page"
import { JobPositionsPage } from "@/pages/job-positions/job-positions-page"
import { WorkSchedulesPage } from "@/pages/schedules/work-schedules-page"
import { UsersPage } from "@/pages/users/users-page"
import { PayrunsPage } from "@/pages/payruns/payruns-page"
import { PayrunDetailsPage } from "@/pages/payruns/payrun-details-page"
import { PayslipsPage } from "@/pages/payslips/payslips-page"
import { PayslipDetailsPage } from "@/pages/payslips/payslip-details-page"
import { MyPayslipsPage } from "@/pages/payslips/my-payslips-page"
import { MyProfilePage } from "@/pages/self-service/my-profile-page"
import { AuditLogsPage } from "@/pages/audit/audit-logs-page"

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

              <Route
                path="contracts"
                element={
                  <ContractsPage />
                }
              />

              <Route
                path="work-schedules"
                element={
                  <WorkSchedulesPage />
                }
              />

              <Route
                path="attendance"
                element={
                  <AttendancePage />
                }
              />

              <Route
                path="my-attendance"
                element={
                  <MyAttendancePage />
                }
              />

              <Route
                path="leave"
                element={
                  <LeaveManagementPage />
                }
              />

              <Route
                path="my-leave"
                element={
                  <MyLeavePage />
                }
              />

              <Route
                path="salary-structures"
                element={
                  <SalaryStructuresPage />
                }
              />

              <Route
                path="salary-structures/:id"
                element={
                  <SalaryStructureDetailsPage />
                }
              />

              <Route
                path="payruns"
                element={
                  <PayrunsPage />
                }
              />

              <Route
                path="payruns/:id"
                element={
                  <PayrunDetailsPage />
                }
              />

              <Route
                path="payslips"
                element={
                  <PayslipsPage />
                }
              />

              <Route
                path="payslips/:id"
                element={
                  <PayslipDetailsPage />
                }
              />

              <Route
                path="my-payslips"
                element={
                  <MyPayslipsPage />
                }
              />

              <Route
                path="my-profile"
                element={
                  <MyProfilePage />
                }
              />

              {/* Admin Only Routes */}
              <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                <Route
                  path="users"
                  element={
                    <UsersPage />
                  }
                />
                <Route
                  path="audit-logs"
                  element={
                    <AuditLogsPage />
                  }
                />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App