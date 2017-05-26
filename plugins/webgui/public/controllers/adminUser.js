const app = angular.module('app');

app.controller('AdminUserController', ['$scope', '$state', '$stateParams', 'adminApi', '$mdMedia', '$localStorage', 'userSortDialog', '$timeout',
  ($scope, $state, $stateParams, adminApi, $mdMedia, $localStorage, userSortDialog, $timeout) => {
    $scope.setTitle('用户');
    $scope.setMenuSearchButton('search');
    if (!$localStorage.admin.userSortSettings) {
      $localStorage.admin.userSortSettings = {
        sort: 'id_asc',
      };
    }
    $scope.userSort = $localStorage.admin.userSortSettings;
    $scope.setMenuRightButton('sort_by_alpha');
    $scope.currentPage = 1;
    $scope.isUserLoading = false;
    $scope.isUserPageFinish = false;
    $scope.users = [];
    const getPageSize = () => {
      if ($mdMedia('xs')) {
        return 30;
      }
      if ($mdMedia('sm')) {
        return 30;
      }
      if ($mdMedia('md')) {
        return 60;
      }
      if ($mdMedia('gt-md')) {
        return 80;
      }
    };
    $scope.setFabButton(() => {
      $state.go('admin.addUser');
    });
    $scope.getUsers = (search) => {
      $scope.isUserLoading = true;
      adminApi.getUser({
        page: $scope.currentPage,
        pageSize: getPageSize(),
        search,
        sort: $scope.userSort.sort,
      }).then(success => {
        $scope.total = success.total;
        if (!search && $scope.menuSearch.text) {
          return;
        }
        if (search && search !== $scope.menuSearch.text) {
          return;
        }
        success.users.forEach(f => {
          $scope.users.push(f);
        });
        if (success.maxPage > $scope.currentPage) {
          $scope.currentPage++;
        } else {
          $scope.isUserPageFinish = true;
        }
        $scope.isUserLoading = false;
      }).catch(() => {
        if ($state.current.name !== 'admin.user') {
          return;
        }
        $timeout(() => {
          $scope.getUsers(search);
        }, 5000);
      });
    };
    const userFilter = () => {
      $scope.users = [];
      $scope.currentPage = 1;
      $scope.isUserPageFinish = false;
      $scope.getUsers($scope.menuSearch.text);
    };
    $scope.toUser = (id) => {
      $state.go('admin.userPage', {userId: id});
    };
    $scope.$on('cancelSearch', () => {
      $scope.users = [];
      $scope.currentPage = 1;
      $scope.isUserPageFinish = false;
      $scope.getUsers();
    });
    let timeoutPromise;
    $scope.$watch('menuSearch.text', () => {
      if (!$scope.menuSearch.text) {
        return;
      }
      timeoutPromise && $timeout.cancel(timeoutPromise);
      timeoutPromise = $timeout(() => {
        userFilter();
      }, 500);
    });
    $scope.view = (inview) => {
      if (!inview || $scope.isUserLoading || $scope.isUserPageFinish) {
        return;
      }
      $scope.getUsers();
    };
    $scope.userSortDialog = () => {
      userSortDialog.show().then(() => {
        $scope.users = [];
        $scope.currentPage = 1;
        $scope.isUserPageFinish = false;
        $scope.getUsers();
      });
    };
    $scope.$on('RightButtonClick', () => {
      $scope.userSortDialog();
    });
  }
])
  .controller('AdminUserPageController', ['$scope', '$state', '$stateParams', '$http', '$mdDialog', 'adminApi', 'orderDialog', 'confirmDialog',
    ($scope, $state, $stateParams, $http, $mdDialog, adminApi, orderDialog, confirmDialog) => {
      $scope.setTitle('用户信息');
      $scope.setMenuButton('arrow_back', 'admin.user');
      const userId = $stateParams.userId;
      const getUserData = () => {
        adminApi.getUserData(userId).then(success => {
          $scope.user = success.user;
          $scope.account = success.account;
          $scope.orders = success.orders;
          $scope.user.account.forEach(f => {
            adminApi.getUserPortLastConnect(f.port).then(success => {
              f.lastConnect = success.lastConnect;
            });
          });
        });
      };
      $scope.editUser = id => {
        $state.go('admin.editUser', { userId: id });
      };
      getUserData();
      $scope.deleteUserAccount = (accountId) => {
        confirmDialog.show({
          text: '将此账号移除出该用户的列表？',
          cancel: '取消',
          confirm: '移除',
          error: '移除账号失败',
          fn: function () {
            return $http.delete(`/api/admin/user/${ userId }/${ accountId }`);
          },
        }).then(() => {
          getUserData();
        }).catch(() => {

        });
      };
      const openDialog = () => {
        $scope.dialog = $mdDialog.show({
          templateUrl: '/public/views/admin/pickAccount.html',
          parent: angular.element(document.body),
          clickOutsideToClose: true,
          preserveScope: true,
          scope: $scope,
        });
      };
      $scope.setFabButton(() => {
        openDialog();
      });
      $scope.confirmAccount = () => {
        $mdDialog.hide($scope.dialog);
        const promise = [];
        $scope.account.forEach(f => {
          if (f.isChecked) {
            promise.push($http.put(`/api/admin/user/${ userId }/${ f.id }`));
          }
        });
        Promise.all(promise).then(success => {
          getUserData();
        });
      };
      $scope.toAccountPage = port => {
        adminApi.getAccountId(port).then(id => {
          $state.go('admin.accountPage', {accountId: id});
        });
      };
      $scope.showOrderInfo = order => {
        orderDialog.show(order);
      };
    }
  ])
  .controller('AdminAddUserController', ['$scope', '$state', '$stateParams', '$http', '$mdBottomSheet', 'alertDialog',
    ($scope, $state, $stateParams, $http, $mdBottomSheet, alertDialog) => {
      $scope.setTitle('添加用户');
      $scope.setMenuButton('arrow_back', 'admin.user');
      $scope.user = {
        type:"normal"
      };
      $scope.cancel = () => {
        $state.go('admin.user');
      };
      $scope.confirm = () => {
        alertDialog.loading();
        $http.post('/api/admin/user', {
          email: $scope.user.email,
          password: $scope.user.password,
          type: $scope.user.type,
        }).then(success => {
          alertDialog.show('添加用户成功', '确定');
          $state.go('admin.user');
        }).catch(() => {
          alertDialog.show('添加用户失败', '确定');
        });
      };

    }
  ])
  .controller('AdminEditUserController', ['$scope', '$state', '$stateParams', '$http', '$mdBottomSheet', 'confirmDialog', 'alertDialog',
    ($scope, $state, $stateParams, $http, $mdBottomSheet, confirmDialog, alertDialog) => {
      $scope.setTitle('编辑用户');
      $scope.setMenuButton('arrow_back', function () {
        $state.go('admin.userPage', {userId: $stateParams.userId});
      });
      $scope.user = {
      };
      const userId = $stateParams.userId;
      $http.get(`/api/admin/user/${ userId }`)
        .then(success => {
          $scope.user.email = success.data.username;
          $scope.user.type = success.data.type;
      });
      $scope.cancel = () => {
        $state.go('admin.userPage', {userId: $stateParams.userId});
      };
      $scope.confirm = () => {
        alertDialog.loading();

        $http.put(`/api/admin/user/${ userId }/data`, {
          password: $scope.user.password,
          type:$scope.user.type
        }).then(success => {
          alertDialog.show('修改用户成功', '确定');
          $state.go('admin.userPage', {userId: $stateParams.userId});
        }).catch(() => {
          alertDialog.show('修改用户失败', '确定');
        });
      };

      $scope.deleteUser = () => {
        confirmDialog.show({
          text: '真的要删除用户吗？',
          cancel: '取消',
          confirm: '删除',
          error: '删除用户失败',
          fn: function () {
            return $http.delete('/api/admin/user/' + userId);
          },
        }).then(() => {
          $state.go('admin.user');
        });
      };
    }
  ]);

