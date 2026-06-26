<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\CompanySetting;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PublicCatalogController extends Controller
{
    public function index(Request $request): View
    {
        $company = CompanySetting::current();

        if (! $company->public_catalog_enabled) {
            throw new NotFoundHttpException();
        }

        $search = trim((string) $request->input('q'));
        $categoryId = (int) $request->input('cat', 0);

        $products = Product::query()
            ->with('category')
            ->where('active', true)
            ->where('public_visible', true)
            ->when($search !== '', fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            }))
            ->when($categoryId > 0, fn ($q) => $q->where('category_id', $categoryId))
            ->orderBy('name')
            ->paginate(24)
            ->withQueryString();

        $categories = Category::whereHas('products', fn ($q) => $q
                ->where('active', true)->where('public_visible', true))
            ->orderBy('name')
            ->get(['id', 'name']);

        return view('public.catalog.index', [
            'company' => $company,
            'products' => $products,
            'categories' => $categories,
            'search' => $search,
            'categoryId' => $categoryId,
        ]);
    }
}
