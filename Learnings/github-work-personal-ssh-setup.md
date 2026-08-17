# GitHub Personal + Work Accounts on the Same Windows Laptop

## Problem

When using a work laptop, Git may already be authenticated to a company's GitHub account.

For example:

- Work GitHub account: `danyalkhan-25`
- Personal GitHub account: `danyalkhan999`
- Personal repository: `danyalkhan999/walkie-talkie`

A common error is:

```text
remote: Permission to danyalkhan999/walkie-talkie.git denied to danyalkhan-25.
fatal: unable to access 'https://github.com/danyalkhan999/walkie-talkie.git/':
The requested URL returned error: 403
```

## Important Concept

Git has two separate concepts:

### 1. Git commit identity

These commands:

```powershell
git config --local user.name "Danyal Khan"
git config --local user.email "danyalkhan8271@gmail.com"
```

control the author information stored in commits.

They do **not** control which GitHub account is used to authenticate a push.

### 2. GitHub authentication

Authentication determines which GitHub account is allowed to push.

On a work laptop, the existing HTTPS/credential-manager authentication may belong to the work account. Changing `user.name` and `user.email` does not change that authentication.

## Recommended Solution

Use SSH with a separate personal SSH key and configure only the personal repository to use that key.

This leaves the existing work GitHub authentication untouched.

The final arrangement is:

```text
Work repositories
    |
    +-- Existing work GitHub credentials

Personal repositories
    |
    +-- Personal SSH key
    |
    +-- danyalkhan999
```

---

# Setup Guide

## Step 1: Create the SSH directory

If the `.ssh` directory does not exist:

```powershell
mkdir "$env:USERPROFILE\.ssh"
```

This creates:

```text
C:\Users\<username>\.ssh
```

## Step 2: Generate the personal SSH key

Run:

```powershell
ssh-keygen -t ed25519 -C "danyalkhan8271@gmail.com" -f "$env:USERPROFILE\.ssh\id_ed25519_personal"
```

### What each part means

```text
ssh-keygen
```

Creates an SSH key pair.

```text
-t ed25519
```

Selects the Ed25519 SSH key algorithm.

```text
-C "danyalkhan8271@gmail.com"
```

Adds the email as a comment/label for identifying the key.

```text
-f "$env:USERPROFILE\.ssh\id_ed25519_personal"
```

Specifies where the key should be saved.

The result is:

```text
C:\Users\<username>\.ssh\id_ed25519_personal
C:\Users\<username>\.ssh\id_ed25519_personal.pub
```

The files are:

```text
id_ed25519_personal       -> PRIVATE KEY
id_ed25519_personal.pub   -> PUBLIC KEY
```

### Security rule

Never share or commit:

```text
id_ed25519_personal
```

The `.pub` file is the public key and can be added to GitHub.

Do **not** store the private key inside the project repository. Keeping it in `.ssh` prevents accidentally committing it with project files.

---

# Step 3: Copy the Public Key

Run:

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_personal.pub"
```

Copy the entire output.

It will look similar to:

```text
ssh-ed25519 AAAAC3... danyalkhan8271@gmail.com
```

---

# Step 4: Add the Key to Personal GitHub

Log in to the personal GitHub account:

```text
danyalkhan999
```

Open:

https://github.com/settings/keys

Then:

1. Click **New SSH key**
2. Title: `Personal Work Laptop`
3. Key type: `Authentication Key`
4. Paste the public key
5. Complete GitHub verification
6. Save the key

---

# Step 5: Test the Personal SSH Key

Run:

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_personal" -T git@github.com
```

The first connection may ask:

```text
The authenticity of host 'github.com' can't be established.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Type:

```text
yes
```

A successful result looks like:

```text
Hi danyalkhan999! You've successfully authenticated, but GitHub does not provide shell access.
```

This confirms that the personal SSH key authenticates as the correct GitHub account.

---

# Step 6: Change the Repository Remote

Go to the project:

```powershell
cd C:\walkie-talkie-ui
```

Change the remote from HTTPS to SSH:

```powershell
git remote set-url origin git@github.com:danyalkhan999/walkie-talkie.git
```

Verify:

```powershell
git remote -v
```

Expected result:

```text
origin  git@github.com:danyalkhan999/walkie-talkie.git (fetch)
origin  git@github.com:danyalkhan999/walkie-talkie.git (push)
```

---

# Step 7: Configure Only This Repository to Use the Personal Key

Because the laptop also contains work GitHub authentication, configure the SSH key at the repository level.

Run:

```powershell
git config --local core.sshCommand 'ssh -i "C:/Users/danya/.ssh/id_ed25519_personal" -o IdentitiesOnly=yes'
```

### Why use `--local`?

`--local` means this configuration applies only to the current Git repository.

It does not change Git's configuration for other repositories.

This is important on a work laptop.

Verify:

```powershell
git config --local core.sshCommand
```

Expected:

```text
ssh -i "C:/Users/danya/.ssh/id_ed25519_personal" -o IdentitiesOnly=yes
```

### Why use forward slashes?

The following can cause Windows path escaping problems:

```text
C:\Users\danya\.ssh\id_ed25519_personal
```

Using:

```text
C:/Users/danya/.ssh/id_ed25519_personal
```

avoids that problem when the value is stored in Git configuration.

---

# Step 8: Push

Finally:

```powershell
git push -u origin main
```

Git should now use:

```text
walkie-talkie-ui
      |
      v
Personal SSH key
      |
      v
GitHub
      |
      v
danyalkhan999
      |
      v
danyalkhan999/walkie-talkie
```

---

# Troubleshooting

## Error: Permission denied to the work account

Example:

```text
remote: Permission to danyalkhan999/walkie-talkie.git denied to danyalkhan-25.
```

Cause:

GitHub is authenticating the push using the work account.

Changing:

```powershell
git config --local user.name
git config --local user.email
```

does not fix authentication.

Use the SSH setup in this document.

---

## Error: Identity file not accessible

Example:

```text
Warning: Identity file C:Usersdanya/.ssh/id_ed25519_personal not accessible:
No such file or directory.
```

Cause:

The SSH path was incorrectly stored without the required Windows path separators.

Fix:

```powershell
git config --local core.sshCommand 'ssh -i "C:/Users/danya/.ssh/id_ed25519_personal" -o IdentitiesOnly=yes'
```

Then verify:

```powershell
git config --local core.sshCommand
```

---

## Verify the key exists

Run:

```powershell
Test-Path "$env:USERPROFILE\.ssh\id_ed25519_personal"
```

Expected:

```text
True
```

---

## Verify the repository remote

Run:

```powershell
git remote -v
```

Expected:

```text
origin  git@github.com:danyalkhan999/walkie-talkie.git (fetch)
origin  git@github.com:danyalkhan999/walkie-talkie.git (push)
```

---

# Useful Commands

### Check local Git identity

```powershell
git config --local user.name
git config --local user.email
```

### Check repository remote

```powershell
git remote -v
```

### Check repository-specific SSH configuration

```powershell
git config --local core.sshCommand
```

### Test personal SSH authentication

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_personal" -T git@github.com
```

### Check SSH files

```powershell
Get-ChildItem "$env:USERPROFILE\.ssh"
```

---

# Final Configuration

For the personal project:

```text
Repository:
C:\walkie-talkie-ui

Remote:
git@github.com:danyalkhan999/walkie-talkie.git

Git commit identity:
Danyal Khan
danyalkhan8271@gmail.com

SSH key:
C:/Users/danya/.ssh/id_ed25519_personal

Git SSH configuration:
repository-local

GitHub account:
danyalkhan999
```

The key design decision is **repository-local SSH configuration**. It lets a work laptop safely use different GitHub identities without replacing or deleting the company's existing credentials.
