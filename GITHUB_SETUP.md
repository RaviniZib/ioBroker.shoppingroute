# GitHub setup for RaviniZib

Target repository:

`RaviniZib/ioBroker.shoppingroute`

## 1. Create the repository on GitHub

Create a **public** repository named exactly:

`ioBroker.shoppingroute`

Do not add a README, .gitignore or license on GitHub because all of these files are already contained in this package.

## 2. Push this folder

Open a terminal inside the extracted `ioBroker.shoppingroute` folder:

```bash
git init
git branch -M main
git add .
git commit -m "Initial shoppingroute adapter 0.0.1"
git remote add origin https://github.com/RaviniZib/ioBroker.shoppingroute.git
git push -u origin main
```

If GitHub asks for authentication, use your normal GitHub authentication method / personal access token or GitHub Desktop.

## 3. First ioBroker test

Keep **Dry-Run enabled** for the first installation.

After the repository is online, install the adapter in ioBroker via the custom GitHub/URL installation in expert mode, create an instance and configure:

- Alexa2 instance: `alexa2.0`
- List: `SHOP`
- Alexa app sorting: **Oldest to newest / Älteste bis neueste**
- Dry-Run: enabled

Check:

- `shoppingroute.0.info.connection`
- `shoppingroute.0.info.lastPlan`
- `shoppingroute.0.info.unknownItems`

Only disable Dry-Run after the plan is correct.

## 4. Public release blocker

Do not publish to npm or request inclusion in the ioBroker repositories until Alexa2/alexa-remote2 accepts list item `value` updates without a manual node_modules patch.
