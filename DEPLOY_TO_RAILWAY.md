# Deploy Vaultline to Railway (step by step)

You need two free accounts: **GitHub** and **Railway**. Railway's volume (the storage that keeps your prices) may need a paid plan; check Railway's pricing page.

## Part 1: Put the code on GitHub
1. **Unzip** `vaultline-market-simulator.zip` on your computer. You'll get a folder called `vaultline`.
2. Go to https://github.com and click **New repository**. Name it `vaultline`, choose **Private**, click **Create repository**.
3. On the empty repo page, click **uploading an existing file**.
4. Open the unzipped `vaultline` folder, select **everything inside it** (the `server` and `client` folders, `package.json`, `railway.json`, etc.) and drag it into the GitHub page. Do not upload the zip file itself.
5. Click **Commit changes**.

## Part 2: Deploy on Railway
1. Go to https://railway.com, log in, and click **New Project** then **Deploy from GitHub repo**.
2. Pick your `vaultline` repo (allow Railway to access GitHub if it asks). Railway builds and starts it automatically.
3. **Add storage so prices survive redeploys:** open your service, go to **Settings**, find **Volumes** (or right-click the service on the canvas and choose **Attach volume**), click **Add Volume**, and set the mount path to `/data`. The app detects it automatically.
4. **Get your link:** in the service go to **Settings**, then **Networking**, then **Generate Domain**. Open the link it gives you (something like `vaultline-production.up.railway.app`).
5. Wait for the deployment to show as active, then open the link. You should see the dashboard.

## Part 3: Use it
- Admin login: open `https://YOUR-LINK/#admin` and enter `abyss51.49`.
- Click **Update prices now**, or turn on **Automatic updates**.
- To change the admin key, open your service, go to **Variables**, add `ADMIN_KEY` with your new key, and Railway will redeploy.
- Discord bot: use `https://YOUR-LINK/api/prices` (see README.md).

## Good to know
- Keep the service at **one instance**. More than one would make separate markets.
- If you skip the volume, prices reset every time you redeploy.
- Don't share the admin key. Anyone who has it can change prices.

## Alternative: upload without GitHub (Railway CLI)
1. Install Node.js, then run `npm install -g @railway/cli` and `railway login`.
2. In the unzipped `vaultline` folder run `railway init`, then `railway up`.
3. Add the volume and generate the domain in the Railway dashboard as in Part 2, steps 3 and 4.
