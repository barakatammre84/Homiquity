import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminCrudMutations } from "@/hooks/useAdminCrudMutations";
import { AdminEntityDialog } from "./AdminEntityDialog";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  HelpCircle,
  FolderOpen,
  AlertCircle,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";

interface ContentCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number | null;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  categoryId: string | null;
  isPublished: boolean | null;
  publishedAt: string | null;
  category?: ContentCategory;
}

interface Faq {
  id: string;
  question: string;
  answer: string;
  categoryId: string | null;
  displayOrder: number | null;
  isPublished: boolean | null;
  category?: ContentCategory;
}

const articleFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  summary: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  categoryId: z.string().optional(),
  isPublished: z.boolean().default(false),
});

const faqFormSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  categoryId: z.string().optional(),
  displayOrder: z.number().default(0),
  isPublished: z.boolean().default(false),
});

const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  displayOrder: z.number().default(0),
});

type ArticleFormData = z.infer<typeof articleFormSchema>;
type FaqFormData = z.infer<typeof faqFormSchema>;
type CategoryFormData = z.infer<typeof categoryFormSchema>;

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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Articles</CardTitle>
                <CardDescription>Manage Learning Center articles</CardDescription>
              </div>
              <Button onClick={() => openArticleDialog(null)} data-testid="button-add-article">
                <Plus className="h-4 w-4 mr-2" />
                Add Article
              </Button>
            </CardHeader>
            <CardContent>
              {articlesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : articles && articles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles.map((article) => (
                      <TableRow key={article.id} data-testid={`row-article-${article.id}`}>
                        <TableCell className="font-medium">{article.title}</TableCell>
                        <TableCell>{article.category?.name || "Uncategorized"}</TableCell>
                        <TableCell>
                          <Badge variant={article.isPublished ? "default" : "secondary"}>
                            {article.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon" aria-label="Edit"
                            onClick={() => openArticleDialog(article)}
                            data-testid={`button-edit-article-${article.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon" aria-label="Delete"
                            onClick={() => articleMutations.remove.mutate(article.id)}
                            disabled={articleMutations.remove.isPending}
                            data-testid={`button-delete-article-${article.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No articles yet. Click "Add Article" to create one.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faqs" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>FAQs</CardTitle>
                <CardDescription>Manage frequently asked questions</CardDescription>
              </div>
              <Button onClick={() => openFaqDialog(null)} data-testid="button-add-faq">
                <Plus className="h-4 w-4 mr-2" />
                Add FAQ
              </Button>
            </CardHeader>
            <CardContent>
              {faqsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : faqs && faqs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faqs.map((faq) => (
                      <TableRow key={faq.id} data-testid={`row-faq-${faq.id}`}>
                        <TableCell className="font-medium max-w-md truncate">{faq.question}</TableCell>
                        <TableCell>{faq.category?.name || "Uncategorized"}</TableCell>
                        <TableCell>
                          <Badge variant={faq.isPublished ? "default" : "secondary"}>
                            {faq.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon" aria-label="Edit"
                            onClick={() => openFaqDialog(faq)}
                            data-testid={`button-edit-faq-${faq.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon" aria-label="Delete"
                            onClick={() => faqMutations.remove.mutate(faq.id)}
                            disabled={faqMutations.remove.isPending}
                            data-testid={`button-delete-faq-${faq.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No FAQs yet. Click "Add FAQ" to create one.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Categories</CardTitle>
                <CardDescription>Organize articles and FAQs by category</CardDescription>
              </div>
              <Button onClick={() => openCategoryDialog(null)} data-testid="button-add-category">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : categories && categories.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                        <TableCell>{category.displayOrder || 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon" aria-label="Edit"
                            onClick={() => openCategoryDialog(category)}
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon" aria-label="Delete"
                            onClick={() => categoryMutations.remove.mutate(category.id)}
                            disabled={categoryMutations.remove.isPending}
                            data-testid={`button-delete-category-${category.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No categories yet. Click "Add Category" to create one.
                </p>
              )}
            </CardContent>
          </Card>
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={articleForm.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-article-title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={articleForm.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-article-slug" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={articleForm.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Summary</FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} data-testid="input-article-summary" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={articleForm.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content (Markdown supported)</FormLabel>
              <FormControl>
                <Textarea {...field} rows={10} data-testid="input-article-content" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={articleForm.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-article-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={articleForm.control}
            name="isPublished"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 pt-8">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-article-published"
                  />
                </FormControl>
                <FormLabel className="!mt-0">Published</FormLabel>
              </FormItem>
            )}
          />
        </div>
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
        <FormField
          control={faqForm.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-faq-question" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={faqForm.control}
          name="answer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Answer</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} data-testid="input-faq-answer" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={faqForm.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-faq-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={faqForm.control}
            name="displayOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Order</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    data-testid="input-faq-order"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={faqForm.control}
          name="isPublished"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2">
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-faq-published"
                />
              </FormControl>
              <FormLabel className="!mt-0">Published</FormLabel>
            </FormItem>
          )}
        />
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={categoryForm.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-category-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={categoryForm.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-category-slug" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={categoryForm.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} data-testid="input-category-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={categoryForm.control}
          name="displayOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Order</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  data-testid="input-category-order"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </AdminEntityDialog>
    </PageShell>
  );
}
