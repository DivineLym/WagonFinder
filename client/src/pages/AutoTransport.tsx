import { Truck, FileText, Package } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function AutoTransport() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Автоперевозки</h1>
            <p className="text-lg text-muted-foreground">
              Управление автомобильными перевозками
            </p>
          </div>
        </div>

        {/* Sub-sections */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Разделы</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Digital Passport */}
            <div className="rounded-lg border border-border bg-card p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Цифровой паспорт</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Управление цифровыми паспортами транспортных средств
                  </p>
                </div>
              </div>
            </div>

            {/* Cargo */}
            <div className="rounded-lg border border-border bg-card p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Товарная партия</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Отслеживание и управление грузами
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
