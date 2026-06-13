---
title: Relations
description: Link models with ref(Model) and get a populated dropdown in the CRUD form — Symfony-style.
---

A field can point at another model. You declare it once, and `crud add` turns it
into a **dropdown populated from the related model's rows** — no hand-wiring. It's
modeled after Symfony's `make:entity` relation flow.

## Declare the relation

Use `ref(Model)` as the field type. The related model must already exist.

```bash
# the model you'll point at
vsceasy model add --name category --fields "id:string!,name:string"

# the field that references it
vsceasy model add --name todo \
  --fields "id:string!,title:string,category:ref(Category)"
```

In the interactive loop the prompt lists the models you can relate to, and an
invalid `ref(X)` errors with the model to create first.

## What the model stores

`category:ref(Category)` becomes a `categoryId` foreign key plus a metadata block:

```ts title="src/models/Todo.ts"
export interface Todo {
  id: string;
  title: string;
  categoryId: string;  // → Category
}

export const TodoRelations = {
  categoryId: { model: 'Category' },
} as const;
```

The FK stores the related row's id. `TodoRelations` is what `crud add` reads to
build the dropdown — you don't touch it by hand.

The dropdown label defaults to the related model's first string field. Override
it with `label=<field>`:

```bash
--fields "...,category:ref(Category, label=name)"
```

## What CRUD generates

Run `crud add` on the model with the relation:

```bash
vsceasy crud add --model todo --menu new:todos
```

Three things get wired automatically:

1. **The form API gains `options()`:**

   ```ts title="src/shared/api.ts"
   export interface TodoFormApi {
     // …
     options(): Promise<Record<string, { value: string; label: string }[]>>;
   }
   ```

2. **The form panel implements it** — loading the related rows over the repo:

   ```ts title="src/panels/todoForm.ts"
   import { CategoriesRepo } from '../models/Category';
   // …
   async options() {
     return {
       categoryId: (await CategoriesRepo().findMany())
         .map((x) => ({ value: String(x.id), label: String(x.name) })),
     };
   }
   ```

3. **The form webview renders a populated `<select>`** — loading options on mount
   and storing the chosen id:

   ```tsx title="src/webview/panels/todoForm/App.tsx"
   const [relOptions, setRelOptions] = useState({});
   useEffect(() => { void api.options().then(setRelOptions); }, []);
   // …
   <select value={form.categoryId ?? ''} onChange={…}>
     <option value="" />
     {(relOptions['categoryId'] ?? []).map((o) => (
       <option key={o.value} value={o.value}>{o.label}</option>
     ))}
   </select>
   ```

The result — the Category field is a dropdown of the actual Category rows:

![A CRUD form with a Category field rendered as a dropdown of Work, Home, Errands](/tutorial/relation-form.svg)

## Scope

Relations are **ManyToOne**: a foreign key on one model pointing at another. The
FK holds the related id — there's no join table, cascade, or eager join. To show
a related label in the **list** (not just the form), join in your service's
`list()` method, or store a denormalized label.

:::tip[Plurals]
`model add` defaults the repo handle to `<Name>s`, so `Category` →
`Categorys`. Pass `--plural Categories` when creating the model for a nicer
generated `CategoriesRepo`.
:::
