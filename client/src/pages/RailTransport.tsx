import { AlertCircle, AlertTriangle, FileCheck, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function RailTransport() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Ж/Д перевозки</h1>
            <p className="text-lg text-muted-foreground">
              Управление железнодорожными перевозками
            </p>
          </div>
        </div>

        {/* Alert Box */}
        <Alert className="border-2 border-yellow-300 bg-yellow-50 text-yellow-900">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="text-lg font-bold text-yellow-900">
            Модуль скоро будет доступен
          </AlertTitle>
          <AlertDescription className="mt-2 text-yellow-800">
            Модуль железнодорожных перевозок находится на стадии проектирования.
            Функционал будет включать расчет ETA, выявление перегруженных станций и
            оптимизацию маршрутов.
          </AlertDescription>
        </Alert>

        {/* Use Cases Section */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Сценарии применения
          </h2>

          <div className="grid grid-cols-2 gap-6">
            {/* Card 1 */}
            <div className="rounded-lg border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <AlertCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-2">
                    Прогнозирование прибытия
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    AI анализирует графики движения поездов, пропускную способность
                    станций и исторические данные для расчета ETA вагона или контейнера.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-lg border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <AlertTriangle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-2">
                    Обнаружение узких мест
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Автоматическое выявление перегруженных станций, задержек
                    формирования составов и отклонений в графике движения.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-lg border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-2">
                    Оптимизация маршрутов и перевалок
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Подбор оптимального маршрута с учетом транзитных станций, смены
                    колеи, скорости обработки и стоимости перевалок.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="rounded-lg border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <FileCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-2">
                    Контроль и проверка документов
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Интеллектуальная проверка ж/д накладных (СМГС/СМПС), договоров
                    перевозки и сопроводительных документов.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
          <p className="text-muted-foreground">
            Этот модуль будет доступен в ближайшее время. Следите за обновлениями!
          </p>
        </div>
      </div>
    </div>
  );
}
