import { User } from "lucide-react";

export default function Profile() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 space-y-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Профиль</h1>
            <p className="text-lg text-muted-foreground">
              Управление вашим профилем
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Раздел находится в разработке
          </p>
        </div>
      </div>
    </div>
  );
}
