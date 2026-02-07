export enum FeedType {
  Starter = 'starter',
  Grower = 'grower',
  Finisher = 'finisher',
}

export interface Supplier {
  id: number;
  supplierName: string;
  contactPerson?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedRecipe {
  id: number;
  recipeName: string;
  feedType: FeedType;
  status: string;
  cost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedRecipeIngredient {
  id: number;
  recipeId: number;
  supplierId?: number | null;
  ingredientName: string;
  proportion: number;
  unit: string;
}

export interface FeedInventory {
  id: number;
  ingredientName: string;
  supplierId?: number | null;
  quantity: number;
  unit: string;
  costPerUnit: number;
  reorderLevel?: number | null;
  lastRestockDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
