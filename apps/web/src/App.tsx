import { Button } from "@/components/ui/button"

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          PeoplePay360
        </h1>

        <p className="mt-4 text-muted-foreground">
          HR & Payroll Management System
        </p>

        <Button className="mt-8">
          System Ready
        </Button>
      </div>
    </main>
  )
}

export default App