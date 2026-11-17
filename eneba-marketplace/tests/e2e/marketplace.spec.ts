import {test,expect} from '@playwright/test';

test('typo discovery and seller offer survive navigation to checkout',async({page})=>{
 await page.goto('/#/search?q=Cybepunk');
 await page.getByRole('link',{name:'Cyberpunk 2077',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Available Offers'})).toBeVisible();
 await page.getByRole('button',{name:'Add to cart',exact:true}).nth(1).click();
 await page.getByRole('link',{name:'Cart items: 1'}).click();
 await expect(page.getByTestId('cart-line')).toContainText('Digital Arc');
 await page.getByTestId('checkout-link').click();
 await expect(page.getByTestId('checkout-login')).toBeVisible();
 await expect(page.getByText(/4242 4242 4242 4242/)).toBeVisible();
});

test('platform and region filters persist in URL',async({page})=>{
 await page.goto('/#/store');
 await page.getByText('Filters',{exact:true}).click();
 await page.getByLabel('Platform',{exact:true}).selectOption('Steam');
 await page.getByLabel('Region',{exact:true}).selectOption('Global');
 await expect(page).toHaveURL(/platform=Steam/);
 await expect(page).toHaveURL(/region=Global/);
});

test('unverified return cannot deliver keys',async({page})=>{
 await page.goto('/#/payment?id=invalid');
 await expect(page.getByTestId('order-key')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Confirming payment'})).toBeVisible();
});

test('homepage gets categories from backend and has no chatbot',async({page})=>{
 const home=await page.request.get('/api/home');
 expect(home.ok()).toBeTruthy();
 expect((await home.json()).categories.length).toBeGreaterThan(0);
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Featured deals'})).toBeVisible();
 await expect(page.getByRole('button',{name:'AI shopping assistant'})).toHaveCount(0);
});
