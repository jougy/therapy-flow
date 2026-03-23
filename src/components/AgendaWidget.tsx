import { useState } from "react";
import { format, isSameDay, parseISO, addHours, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, X, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AgendaEvent {
  id: string;
  title: string;
  date: Date;
  time: string;
}

const AgendaWidget = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("09:00");

  const dayEvents = events
    .filter((e) => isSameDay(e.date, selectedDate))
    .sort((a, b) => a.time.localeCompare(b.time));

  const datesWithEvents = events.map((e) => e.date);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: newTitle.trim(),
        date: selectedDate,
        time: newTime,
      },
    ]);
    setNewTitle("");
    setNewTime("09:00");
    setShowAdd(false);
  };

  const handleRemove = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-150">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Agenda</CardTitle>
        <div className="p-2 rounded-lg bg-primary/10">
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
              <CalendarDays className="h-4 w-4 mr-2" />
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              className={cn("p-3 pointer-events-auto")}
              modifiers={{ hasEvent: datesWithEvents }}
              modifiersClassNames={{ hasEvent: "bg-primary/20 font-bold" }}
            />
          </PopoverContent>
        </Popover>

        <div className="space-y-1.5 max-h-28 overflow-auto">
          {dayEvents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Sem eventos</p>
          )}
          {dayEvents.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5 group">
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{ev.time}</span>
                <span className="font-medium truncate">{ev.title}</span>
              </div>
              <button
                onClick={() => handleRemove(ev.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar evento
        </Button>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Novo evento — {format(selectedDate, "dd/MM/yyyy")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Consulta, reunião..." />
              </div>
              <div>
                <Label>Horário</Label>
                <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">Cancelar</Button>
              </DialogClose>
              <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim()}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AgendaWidget;
