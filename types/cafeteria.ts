export interface MenuItem {
  name: string;
  calories?: number;
  allergens?: string[];
}

export interface CafeteriaMenu {
  id: string;
  date: string;
  dayOfWeek: string;
  breakfast: MenuItem[];
  lunch: {
    a?: MenuItem[];
    b?: MenuItem[];
  };
  dinner: MenuItem[];
  location: string;
}
