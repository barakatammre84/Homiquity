import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminCrudMutations } from "@/hooks/useAdminCrudMutations";
import { AdminEntityDialog } from "./AdminEntityDialog";
import { FileText, HelpCircle, FolderOpen, AlertCircle } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import {
  articleFormSchema,
  faqFormSchema,
  categoryFormSchema,
  type Article,
  type ArticleFormData,
  type CategoryFormData,
  type ContentCategory,
  type Faq,
  type FaqFormData,
} from "./adminContent/types";
import { ArticlesTable } from "./adminContent/ArticlesTable";
import { FaqsTable } from "./adminContent/FaqsTable";
import { CategoriesTable } from "./adminContent/CategoriesTable";
import { ArticleFormFields } from "./adminContent/ArticleFormFields";
import { FaqFormFields } from "./adminContent/FaqFormFields";
import { CategoryFormFields } from "./adminContent/CategoryFormFields";

export default function AdminContent() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("articles");
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [editingCategory, setEditingCategory] = useState<ContentCategory | null>(null);

  const articleForm = useForm<ArticleFormData>({
    resolver: zodResolver(articleFormSchema),
    defaultValues: {
      title: "",
      slug: "",
      summary: "",
      content: "",
      categoryId: "",
      isPublished: false,
    },
  });

  const faqForm = useForm<FaqFormData>({
    resolver: zodResolver(faqFormSchema),
    defaultValues: {
      question: "",
      answer: "",
      categoryId: "",
      displayOrder: 0,
      isPublished: false,
    },
  });

  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      displayOrder: 0,
    },
  });

  const { data: articles, isLoading: articlesLoading } = useQuery<Article[]>({
    queryKey: ["/api/admin/articles"],
    enabled: !!user && user.role === "admin",
  });

  const { data: faqs, isLoading: faqsLoading } = useQuery<Faq[]>({
    queryKey: ["/api/admin/faqs"],
    enabled: !!user && user.role === "admin",
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery<ContentCategory[]>({
    queryKey: ["/api/admin/content-categories"],
    enabled: !!user && user.role === "admin",
  });

  // All three entities follow the admin REST convention, so the create/update/
  // delete trio comes from one hook (see useAdminCrudMutations). Only the
  // endpoint, the toast wording, and the payload nulling differ.
  const articleMutations = useAdminCrudMutations<ArticleFormData>({
    endpoint: "/api/admin/articles",
    successLabel: "Article",
    errorLabel: "article",
    toPayload: (data) => ({
      ...data,
      categoryId: data.categoryId || null,
      summary: data.summary || null,
    }),
    onSaved: () => {
      setArticleDialogOpen(false);
      setEditingArticle(null);
      articleForm.reset();
    },
  });

  const faqMutations = useAdminCrudMutations<FaqFormData>({
    endpoint: "/api/admin/faqs",
    successLabel: "FAQ",
    errorLabel: "FAQ",
    toPayload: (data) => ({ ...data, categoryId: data.categoryId || null }),
    onSaved: () => {
      setFaqDialogOpen(false);
      setEditingFaq(null);
      faqForm.reset();
    },
  });

  const categoryMutations = useAdminCrudMutations<CategoryFormData>({
    endpoint: "/api/admin/content-categories",
    successLabel: "Category",
    errorLabel: "category",
    toPayload: (data) => ({ ...data, description: data.description || null }),
    onSaved: () => {
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
    },
  });

  const openArticleDialog = (article: Article | null) => {
    setEditingArticle(article);
    if (article) {
      articleForm.reset({
        title: article.title,
        slug: article.slug,
        summary: article.summary || "",
        content: article.content,
        categoryId: article.categoryId || "",
        isPublished: article.isPublished || false,
      });
    } else {
      articleForm.reset({
        title: "",
        slug: "",
        summary: "",
        content: "",
        categoryId: "",
        isPublished: false,
      });
    }
    setArticleDialogOpen(true);
  };

  const openFaqDialog = (faq: Faq | null) => {
    setEditingFaq(faq);
    if (faq) {
      faqForm.reset({
        question: faq.question,
        answer: faq.answer,
        categoryId: faq.categoryId || "",
        displayOrder: faq.displayOrder || 0,
        isPublished: faq.isPublished || false,
      });
    } else {
      faqForm.reset({
        question: "",
        answer: "",
        categoryId: "",
        displayOrder: 0,
        isPublished: false,
      });
    }
    setFaqDialogOpen(true);
  };

  const openCategoryDialog = (category: ContentCategory | null) => {
    setEditingCategory(category);
    if (category) {
      categoryForm.reset({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
        displayOrder: category.displayOrder || 0,
      });
    } else {
      categoryForm.reset({
        name: "",
        slug: "",
        description: "",
        displayOrder: 0,
      });
    }
    setCategoryDialogOpen(true);
  };

  const handleArticleSubmit = (data: ArticleFormData) => {
    if (editingArticle) {
      articleMutations.update.mutate({ id: editingArticle.id, data });
    } else {
      articleMutations.create.mutate(data);
    }
  };

  const handleFaqSubmit = (data: FaqFormData) => {
    if (editingFaq) {
      faqMutations.update.mutate({ id: editingFaq.id, data });
    } else {
      faqMutations.create.mutate(data);
    }
  };

  const handleCategorySubmit = (data: CategoryFormData) => {
    if (editingCategory) {
      categoryMutations.update.mutate({ id: editingCategory.id, data });
    } else {
      categoryMutations.create.mutate(data);
    }
  };

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground mt-2">
              You don't have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageShell
      width="full"
      title="Content Management"
      subtitle="Manage articles, FAQs, and categories for the Learning Center"
      titleTestId="text-page-title"
      contentClassName="space-y-6"
    >

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="articles" data-testid="tab-articles">
            <FileText className="h-4 w-4 mr-2" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="faqs" data-testid="tab-faqs">
            <HelpCircle className="h-4 w-4 mr-2" />
            FAQs
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <FolderOpen className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="mt-6">
          <ArticlesTable
            articles={articles}
            isLoading={articlesLoading}
            onAdd={() => openArticleDialog(null)}
            onEdit={openArticleDialog}
            removeMutation={articleMutations.remove}
          />
        </TabsContent>

        <TabsContent value="faqs" className="mt-6">
          <FaqsTable
            faqs={faqs}
            isLoading={faqsLoading}
            onAdd={() => openFaqDialog(null)}
            onEdit={openFaqDialog}
            removeMutation={faqMutations.remove}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoriesTable
            categories={categories}
            isLoading={categoriesLoading}
            onAdd={() => openCategoryDialog(null)}
            onEdit={openCategoryDialog}
            removeMutation={categoryMutations.remove}
          />
        </TabsContent>
      </Tabs>

      <AdminEntityDialog
        open={articleDialogOpen}
        onOpenChange={setArticleDialogOpen}
        entityLabel="Article"
        entityLabelLower="article"
        isEditing={!!editingArticle}
        form={articleForm}
        onSubmit={handleArticleSubmit}
        isSaving={articleMutations.isSaving}
        saveTestId="button-save-article"
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <ArticleFormFields form={articleForm} categories={categories} />
      </AdminEntityDialog>

      <AdminEntityDialog
        open={faqDialogOpen}
        onOpenChange={setFaqDialogOpen}
        entityLabel="FAQ"
        isEditing={!!editingFaq}
        form={faqForm}
        onSubmit={handleFaqSubmit}
        isSaving={faqMutations.isSaving}
        saveTestId="button-save-faq"
      >
        <FaqFormFields form={faqForm} categories={categories} />
      </AdminEntityDialog>

      <AdminEntityDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        entityLabel="Category"
        entityLabelLower="category"
        isEditing={!!editingCategory}
        form={categoryForm}
        onSubmit={handleCategorySubmit}
        isSaving={categoryMutations.isSaving}
        saveTestId="button-save-category"
      >
        <CategoryFormFields form={categoryForm} />
      </AdminEntityDialog>
    </PageShell>
  );
}
